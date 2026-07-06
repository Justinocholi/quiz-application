import Papa from "papaparse";
import * as XLSX from "xlsx";
import { DayAnalysis } from "./transmissionAnalyzer";

function toRows(days: DayAnalysis[]) {
  return days.map((d) => ({
    Date: d.dateLabel,
    "Morning Transmission": d.morning ? d.morning.timeLabel : "No Morning Transmission",
    "Evening Transmission": d.evening ? d.evening.timeLabel : "No Evening Transmission",
    "Battery (%)": d.battery !== null ? `${d.battery}%` : "N/A",
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(days: DayAnalysis[]) {
  const csv = Papa.unparse(toRows(days));
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "transmission-report.csv");
}

export function exportExcel(days: DayAnalysis[]) {
  const ws = XLSX.utils.json_to_sheet(toRows(days));
  ws["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 26 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transmissions");
  XLSX.writeFile(wb, "transmission-report.xlsx");
}

export function printReport() {
  window.print();
}
