export interface ExportColumn<T> {
  label: string;
  value: (row: T) => string | number;
  /** Format angka Excel, mis. '"Rp" #,##0' */
  numFmt?: string;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV memakai pemisah titik koma + BOM agar langsung rapi di Excel berbahasa Indonesia. */
export function exportCsv<T>(rows: T[], cols: ExportColumn<T>[], filename: string) {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map((c) => esc(c.label)).join(";"), ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(";"))];
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), filename + ".csv");
}

export async function exportExcel<T>(rows: T[], cols: ExportColumn<T>[], filename: string, sheetName = "Rekap") {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = cols.map((c) => ({ header: c.label, width: Math.max(12, c.label.length + 4), style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(cols.map((c) => c.value(r))));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename + ".xlsx");
}
