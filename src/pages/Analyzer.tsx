import { useCallback, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowUpDown,
  BatteryCharging,
  BatteryLow,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileUp,
  Moon,
  Printer,
  RotateCcw,
  Search,
  Sun,
  Sunrise,
  Sunset,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DayAnalysis,
  TransmissionRecord,
  analyzeRecords,
  parseCsvFile,
  summarize,
} from "@/lib/transmissionAnalyzer";
import { exportCsv, exportExcel, printReport } from "@/lib/exportUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PAGE_SIZE = 25;

type SortKey = "date" | "morning" | "evening" | "battery";
type BatteryFilter = "all" | "below50" | "below30";

interface LoadedFile {
  name: string;
  rows: number;
  skipped: number;
}

const Analyzer = () => {
  const [records, setRecords] = useState<TransmissionRecord[]>([]);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [search, setSearch] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [missingMorningOnly, setMissingMorningOnly] = useState(false);
  const [missingEveningOnly, setMissingEveningOnly] = useState(false);
  const [batteryFilter, setBatteryFilter] = useState<BatteryFilter>("all");

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedDay, setSelectedDay] = useState<DayAnalysis | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => analyzeRecords(records), [records]);
  const summary = useMemo(() => summarize(days, records.length), [days, records.length]);

  const filteredDays = useMemo(() => {
    let result = days;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((d) => d.dateLabel.toLowerCase().includes(q) || d.dateKey.includes(q));
    if (rangeFrom) result = result.filter((d) => d.dateKey >= rangeFrom);
    if (rangeTo) result = result.filter((d) => d.dateKey <= rangeTo);
    if (missingMorningOnly) result = result.filter((d) => !d.morning);
    if (missingEveningOnly) result = result.filter((d) => !d.evening);
    if (batteryFilter !== "all") {
      const limit = batteryFilter === "below50" ? 50 : 30;
      result = result.filter((d) => d.battery !== null && d.battery < limit);
    }
    return result;
  }, [days, search, rangeFrom, rangeTo, missingMorningOnly, missingEveningOnly, batteryFilter]);

  const sortedDays = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const val = (d: DayAnalysis): string | number => {
      switch (sortKey) {
        case "date":
          return d.dateKey;
        case "morning":
          return d.morning ? d.morning.minutes : -1;
        case "evening":
          return d.evening ? d.evening.minutes : -1;
        case "battery":
          return d.battery ?? -1;
      }
    };
    return [...filteredDays].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [filteredDays, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedDays.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageDays = sortedDays.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const chartData = useMemo(
    () =>
      days
        .filter((d) => d.battery !== null)
        .map((d) => ({ date: d.dateLabel, battery: d.battery as number })),
    [days]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const csvFiles = Array.from(fileList).filter(
        (f) => f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv"
      );
      if (csvFiles.length === 0) {
        toast.error("Unsupported file type", { description: "Please upload one or more .csv files." });
        return;
      }
      setUploading(true);
      const newRecords: TransmissionRecord[] = [];
      const newFiles: LoadedFile[] = [];
      for (const file of csvFiles) {
        try {
          const result = await parseCsvFile(file);
          newRecords.push(...result.records);
          newFiles.push({ name: file.name, rows: result.records.length, skipped: result.skippedRows });
          if (result.skippedRows > 0) {
            toast.warning(`${file.name}: skipped ${result.skippedRows} malformed row(s)`, {
              description: "Rows without a readable date and time were ignored.",
            });
          }
        } catch (e) {
          toast.error("Could not process file", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
      }
      setUploading(false);
      if (newRecords.length > 0) {
        setRecords((prev) => [...prev, ...newRecords]);
        setFiles((prev) => [...prev, ...newFiles]);
        setPage(1);
        toast.success(
          `Loaded ${newRecords.length.toLocaleString()} transmission(s) from ${newFiles.length} file(s)`
        );
      }
    },
    []
  );

  const resetAll = () => {
    setRecords([]);
    setFiles([]);
    setSearch("");
    setRangeFrom("");
    setRangeTo("");
    setMissingMorningOnly(false);
    setMissingEveningOnly(false);
    setBatteryFilter("all");
    setPage(1);
    toast.info("Cleared all data");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(1);
  };

  const filtersActive =
    search || rangeFrom || rangeTo || missingMorningOnly || missingEveningOnly || batteryFilter !== "all";

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (
      <ArrowDownUp className={`h-3.5 w-3.5 ${sortAsc ? "" : "rotate-180"} text-blue-600`} />
    ) : (
      <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
    );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 text-white shadow print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2.5">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">Device Transmission Analyzer</h1>
              <p className="text-sm text-blue-100">
                Morning window 7:30–8:00 AM · Evening window 5:00–6:00 PM
              </p>
            </div>
          </div>
          {records.length > 0 && (
            <button
              onClick={resetAll}
              className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Upload zone */}
        <section
          className={`rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors print:hidden ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="font-medium text-slate-700">Parsing CSV data…</p>
              <div className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2"
            >
              <UploadCloud className="h-12 w-12 text-blue-500" />
              <p className="text-lg font-semibold text-slate-800">
                Drag &amp; drop CSV files here, or <span className="text-blue-600 underline">browse</span>
              </p>
              <p className="text-sm text-slate-500">
                Expected columns: Timestamp (or Date + Time), Temperature, Humidity, Battery Level (%),
                Device ID. Multiple files are merged automatically.
              </p>
            </button>
          )}
          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  {f.name} · {f.rows.toLocaleString()} rows
                </span>
              ))}
            </div>
          )}
        </section>

        {records.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-sm">
            <CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            Upload a CSV file to see the daily transmission report.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Days Analyzed" value={summary.totalDays.toLocaleString()} />
              <SummaryCard icon={<Sunrise className="h-5 w-5" />} label="Morning Transmissions" value={summary.morningCount.toLocaleString()} />
              <SummaryCard icon={<Sunset className="h-5 w-5" />} label="Evening Transmissions" value={summary.eveningCount.toLocaleString()} />
              <SummaryCard icon={<Sun className="h-5 w-5" />} label="Missing Morning" value={summary.missingMorning.toLocaleString()} warn={summary.missingMorning > 0} />
              <SummaryCard icon={<Moon className="h-5 w-5" />} label="Missing Evening" value={summary.missingEvening.toLocaleString()} warn={summary.missingEvening > 0} />
              <SummaryCard
                icon={summary.avgBattery !== null && summary.avgBattery < 30 ? <BatteryLow className="h-5 w-5" /> : <BatteryCharging className="h-5 w-5" />}
                label="Avg Battery"
                value={summary.avgBattery !== null ? `${summary.avgBattery.toFixed(1)}%` : "N/A"}
                warn={summary.avgBattery !== null && summary.avgBattery < 30}
              />
            </section>

            {/* Battery trend chart */}
            {chartData.length > 1 && (
              <section className="rounded-2xl bg-white p-5 shadow-sm print:hidden">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Battery Trend Over Time</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} minTickGap={40} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} unit="%" />
                      <ChartTooltip
                        formatter={(v: number) => [`${v}%`, "Battery"]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="battery" stroke="#2563eb" strokeWidth={2} dot={{ r: 2.5, fill: "#2563eb" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Filters + exports */}
            <section className="rounded-2xl bg-white p-4 shadow-sm print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by date (e.g. 01 Jul or 2026-07-01)"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  From
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  To
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => { setRangeTo(e.target.value); setPage(1); }}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <select
                  value={batteryFilter}
                  onChange={(e) => { setBatteryFilter(e.target.value as BatteryFilter); setPage(1); }}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All battery levels</option>
                  <option value="below50">Battery below 50%</option>
                  <option value="below30">Battery below 30%</option>
                </select>
                <FilterToggle
                  active={missingMorningOnly}
                  onClick={() => { setMissingMorningOnly((v) => !v); setPage(1); }}
                  label="Missing morning only"
                />
                <FilterToggle
                  active={missingEveningOnly}
                  onClick={() => { setMissingEveningOnly((v) => !v); setPage(1); }}
                  label="Missing evening only"
                />
                {filtersActive && (
                  <button
                    onClick={() => {
                      setSearch(""); setRangeFrom(""); setRangeTo("");
                      setMissingMorningOnly(false); setMissingEveningOnly(false);
                      setBatteryFilter("all"); setPage(1);
                    }}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <ExportButton onClick={() => exportCsv(sortedDays)} icon={<Download className="h-4 w-4" />} label="CSV" />
                  <ExportButton onClick={() => exportExcel(sortedDays)} icon={<FileSpreadsheet className="h-4 w-4" />} label="Excel" />
                  <ExportButton onClick={printReport} icon={<Printer className="h-4 w-4" />} label="Print" />
                </div>
              </div>
            </section>

            {/* Results table */}
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-blue-600 text-white">
                    <tr>
                      <SortHeader label="Date" onClick={() => toggleSort("date")} icon={sortIcon("date")} />
                      <SortHeader label="Morning Transmission" onClick={() => toggleSort("morning")} icon={sortIcon("morning")} />
                      <SortHeader label="Evening Transmission" onClick={() => toggleSort("evening")} icon={sortIcon("evening")} />
                      <SortHeader label="Battery (%)" onClick={() => toggleSort("battery")} icon={sortIcon("battery")} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageDays.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                          No days match the current filters.
                        </td>
                      </tr>
                    ) : (
                      pageDays.map((d) => (
                        <tr
                          key={d.dateKey}
                          onClick={() => setSelectedDay(d)}
                          className="cursor-pointer transition-colors hover:bg-blue-50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">{d.dateLabel}</td>
                          <td className="px-4 py-3">
                            {d.morning ? (
                              <span className="text-slate-700">{d.morning.timeLabel}</span>
                            ) : (
                              <MissingBadge label="No Morning Transmission" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {d.evening ? (
                              <span className="text-slate-700">{d.evening.timeLabel}</span>
                            ) : (
                              <MissingBadge label="No Evening Transmission" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {d.battery !== null ? (
                              <span
                                className={
                                  d.battery < 30
                                    ? "inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 font-semibold text-red-700"
                                    : "font-medium text-slate-700"
                                }
                              >
                                {d.battery < 30 && <BatteryLow className="h-3.5 w-3.5" />}
                                {d.battery}%
                              </span>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 print:hidden">
                <span>
                  Showing {pageDays.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
                  {(currentPage - 1) * PAGE_SIZE + pageDays.length} of {sortedDays.length.toLocaleString()} days
                  {" · "}{summary.totalRecords.toLocaleString()} transmissions loaded
                </span>
                <div className="flex items-center gap-1">
                  <PageButton disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </PageButton>
                  <span className="px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <PageButton disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </PageButton>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transmissions on {selectedDay?.dateLabel}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Temp</th>
                  <th className="px-3 py-2 font-semibold">Humidity</th>
                  <th className="px-3 py-2 font-semibold">Battery</th>
                  <th className="px-3 py-2 font-semibold">Device</th>
                  <th className="px-3 py-2 font-semibold">Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedDay?.records.map((r, i) => {
                  const isMorning = selectedDay.morning === r;
                  const isEvening = selectedDay.evening === r;
                  return (
                    <tr key={i} className={isMorning || isEvening ? "bg-blue-50" : ""}>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.timeLabel}</td>
                      <td className="px-3 py-2 text-slate-600">{r.temperature ?? "–"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.humidity ?? "–"}</td>
                      <td className={`px-3 py-2 ${r.battery !== null && r.battery < 30 ? "font-semibold text-red-600" : "text-slate-600"}`}>
                        {r.battery !== null ? `${r.battery}%` : "–"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.deviceId ?? "–"}</td>
                      <td className="px-3 py-2">
                        {isMorning && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Morning pick</span>
                        )}
                        {isEvening && (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">Evening pick</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCard = ({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm">
    <div className={`mb-2 inline-flex rounded-lg p-2 ${warn ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
      {icon}
    </div>
    <p className={`text-2xl font-bold ${warn ? "text-amber-600" : "text-slate-800"}`}>{value}</p>
    <p className="text-xs font-medium text-slate-500">{label}</p>
  </div>
);

const FilterToggle = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-slate-300 bg-white text-slate-600 hover:border-blue-400"
    }`}
  >
    {label}
  </button>
);

const ExportButton = ({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
  >
    {icon}
    {label}
  </button>
);

const SortHeader = ({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) => (
  <th className="px-4 py-3 font-semibold">
    <button onClick={onClick} className="flex items-center gap-1.5">
      {label}
      {icon}
    </button>
  </th>
);

const MissingBadge = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
    <AlertTriangle className="h-3.5 w-3.5" />
    {label}
  </span>
);

const PageButton = ({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className="rounded-lg border border-slate-300 p-1.5 transition-colors hover:bg-slate-100 disabled:opacity-40"
  >
    {children}
  </button>
);

export default Analyzer;
