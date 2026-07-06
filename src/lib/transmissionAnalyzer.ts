import Papa from "papaparse";

export interface TransmissionRecord {
  dateKey: string; // YYYY-MM-DD
  minutes: number; // minutes since midnight
  timeLabel: string; // hh:mm AM/PM
  battery: number | null;
  temperature: number | null;
  humidity: number | null;
  deviceId: string | null;
  sourceFile: string;
}

export interface DayAnalysis {
  dateKey: string;
  dateLabel: string; // 01 Jul 2026
  morning: TransmissionRecord | null;
  evening: TransmissionRecord | null;
  battery: number | null;
  records: TransmissionRecord[];
}

export interface AnalysisSummary {
  totalDays: number;
  morningCount: number;
  eveningCount: number;
  missingMorning: number;
  missingEvening: number;
  avgBattery: number | null;
  totalRecords: number;
}

const MORNING_START = 7 * 60 + 30; // 7:30 AM
const MORNING_END = 8 * 60; // 8:00 AM
const EVENING_START = 17 * 60; // 5:00 PM
const EVENING_END = 18 * 60; // 6:00 PM

export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const cand of candidates) {
    const hit = normalized.find((h) => h.norm === cand);
    if (hit) return hit.raw;
  }
  for (const cand of candidates) {
    const hit = normalized.find((h) => h.norm.includes(cand));
    if (hit) return hit.raw;
  }
  return null;
}

function toDateKey(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 100) y += 2000;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse a date string in common formats into YYYY-MM-DD. */
export function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); // ISO: 2026-07-01
  if (m) return toDateKey(+m[1], +m[2], +m[3]);

  m = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/); // DD/MM/YYYY or MM/DD/YYYY
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    // Disambiguate: if first part can't be a month, treat as day-first
    if (a > 12 && b <= 12) return toDateKey(y, b, a);
    if (b > 12 && a <= 12) return toDateKey(y, a, b);
    // Default to day-first (DD/MM/YYYY)
    return toDateKey(y, b, a);
  }

  m = v.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{2,4})/); // 01 Jul 2026
  if (m) {
    const month = monthIndex(m[2]);
    if (month) return toDateKey(+m[3], month, +m[1]);
  }

  m = v.match(/^([A-Za-z]{3,})[\s-](\d{1,2}),?[\s-](\d{2,4})/); // Jul 1, 2026
  if (m) {
    const month = monthIndex(m[1]);
    if (month) return toDateKey(+m[3], month, +m[2]);
  }

  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) {
    return toDateKey(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return null;
}

function monthIndex(name: string): number | null {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const idx = months.indexOf(name.slice(0, 3).toLowerCase());
  return idx === -1 ? null : idx + 1;
}

/** Parse a time string ("07:32", "7:32 AM", "17:32:10") into minutes since midnight. */
export function parseTime(value: string): number | null {
  const v = value.trim();
  const m = v.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm]?)?/);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ampm = m[4]?.toLowerCase();
  if (h > 23 || min > 59) return null;
  if (ampm?.startsWith("p") && h < 12) h += 12;
  if (ampm?.startsWith("a") && h === 12) h = 0;
  return h * 60 + min;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value).replace(/[%\s]/g, ""));
  return isNaN(n) ? null : n;
}

export interface ParseResult {
  records: TransmissionRecord[];
  skippedRows: number;
  errors: string[];
}

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete: (results) => {
        try {
          resolve(extractRecords(results.data, results.meta.fields ?? [], file.name));
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(new Error(`Failed to parse "${file.name}": ${err.message}`)),
    });
  });
}

export function extractRecords(
  rows: Record<string, string>[],
  headers: string[],
  sourceFile: string
): ParseResult {
  if (!headers.length || rows.length === 0) {
    throw new Error(`"${sourceFile}" appears to be empty or has no header row.`);
  }

  const timestampCol = findColumn(headers, ["timestamp", "datetime"]);
  const dateCol = findColumn(headers, ["date"]);
  const timeCol = findColumn(headers, ["time"]);
  const batteryCol = findColumn(headers, ["batterylevel", "battery"]);
  const tempCol = findColumn(headers, ["temperature", "temp"]);
  const humidityCol = findColumn(headers, ["humidity"]);
  const deviceCol = findColumn(headers, ["deviceid", "device"]);

  if (!timestampCol && !(dateCol && timeCol)) {
    throw new Error(
      `"${sourceFile}" is missing required columns. Expected a "Timestamp" column, or both "Date" and "Time" columns. Found: ${headers.join(", ")}`
    );
  }

  const records: TransmissionRecord[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    let dateKey: string | null = null;
    let minutes: number | null = null;

    if (dateCol && timeCol && row[dateCol] && row[timeCol]) {
      dateKey = parseDate(row[dateCol]);
      minutes = parseTime(row[timeCol]);
    }
    if ((dateKey === null || minutes === null) && timestampCol && row[timestampCol]) {
      const ts = row[timestampCol].trim();
      const sep = ts.match(/^(.+?)[T\s](.+)$/);
      if (sep) {
        dateKey = parseDate(sep[1]);
        minutes = parseTime(sep[2]);
      }
    }

    if (dateKey === null || minutes === null) {
      skippedRows++;
      continue;
    }

    records.push({
      dateKey,
      minutes,
      timeLabel: formatMinutes(minutes),
      battery: batteryCol ? parseNumber(row[batteryCol]) : null,
      temperature: tempCol ? parseNumber(row[tempCol]) : null,
      humidity: humidityCol ? parseNumber(row[humidityCol]) : null,
      deviceId: deviceCol ? row[deviceCol]?.trim() || null : null,
      sourceFile,
    });
  }

  if (records.length === 0) {
    throw new Error(
      `No valid rows could be read from "${sourceFile}". Check that dates and times are in a recognizable format.`
    );
  }

  return { records, skippedRows, errors: [] };
}

export function analyzeRecords(records: TransmissionRecord[]): DayAnalysis[] {
  const byDay = new Map<string, TransmissionRecord[]>();
  for (const r of records) {
    const list = byDay.get(r.dateKey);
    if (list) list.push(r);
    else byDay.set(r.dateKey, [r]);
  }

  const days: DayAnalysis[] = [];
  for (const [dateKey, dayRecords] of byDay) {
    dayRecords.sort((a, b) => a.minutes - b.minutes);

    let morning: TransmissionRecord | null = null;
    let evening: TransmissionRecord | null = null;
    for (const r of dayRecords) {
      if (r.minutes >= MORNING_START && r.minutes <= MORNING_END && !morning) {
        morning = r; // first in window
      }
      if (r.minutes >= EVENING_START && r.minutes <= EVENING_END) {
        evening = r; // last in window (records are sorted ascending)
      }
    }

    const battery = evening?.battery ?? morning?.battery ?? null;
    days.push({ dateKey, dateLabel: formatDateLabel(dateKey), morning, evening, battery, records: dayRecords });
  }

  days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return days;
}

export function summarize(days: DayAnalysis[], totalRecords: number): AnalysisSummary {
  const morningCount = days.filter((d) => d.morning).length;
  const eveningCount = days.filter((d) => d.evening).length;
  const batteries = days.map((d) => d.battery).filter((b): b is number => b !== null);
  return {
    totalDays: days.length,
    morningCount,
    eveningCount,
    missingMorning: days.length - morningCount,
    missingEvening: days.length - eveningCount,
    avgBattery: batteries.length ? batteries.reduce((a, b) => a + b, 0) / batteries.length : null,
    totalRecords,
  };
}
