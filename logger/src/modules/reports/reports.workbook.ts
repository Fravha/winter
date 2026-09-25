import ExcelJS from "exceljs";
import { AppError } from "../../shared/errors/app-error.js";
import { MAX_REPORT_ROWS } from "../../shared/reports/report-limits.js";

export type ReportCell = string | number | Date | null | undefined;
export type ReportRow = Record<string, ReportCell>;
export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
}

// Only domain decimal fields are converted. IDs, codes, dates and free text
// retain their original types. A subtotal can have six fractional digits.
const decimalScales: Readonly<Record<string, number>> = {
  quantity: 3,
  unitPrice: 3,
  subtotal: 6,
  generated: 3,
  consumed: 3,
  separated: 3,
  lost: 3,
  transferredToInventory: 3,
  available: 3,
  capacity: 3,
  stockBefore: 3,
  resultingStock: 3,
  value: 6,
};

export function excelDecimal(value: ReportCell): ReportCell {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  const significantDigits = value.replace(/^-/, "").replace(".", "").replace(/^0+/, "").length || 1;
  // Excel stores at most 15 significant decimal digits. Preserve larger
  // values verbatim rather than silently rounding them to a different amount.
  if (significantDigits > 15) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

export function createReportWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Winter";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;
  return workbook;
}

export function addReportSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: readonly ReportColumn[],
  rows: readonly ReportRow[],
): ExcelJS.Worksheet {
  const alreadyAdded = workbook.worksheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rowCount - 1), 0);
  if (alreadyAdded + rows.length > MAX_REPORT_ROWS) {
    throw new AppError(
      "REPORT_RESULT_TOO_LARGE",
      `The workbook exceeds the ${MAX_REPORT_ROWS}-data-row export limit. Narrow the filters and retry; no rows were truncated.`,
      413,
    );
  }
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.min(Math.max(column.header.length + 2, 14), 36),
    ...(column.numFmt || column.key in decimalScales
      ? { style: { numFmt: column.numFmt ?? `#,##0.${"0".repeat(decimalScales[column.key]!)}` } }
      : {}),
  }));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF315B4C" } };
  worksheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  for (const row of rows) {
    const cells = { ...row };
    for (const column of columns) {
      if (column.key in decimalScales) cells[column.key] = excelDecimal(row[column.key]);
    }
    worksheet.addRow(cells);
  }
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: Math.max(1, columns.length) },
  };
  return worksheet;
}

export async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function decimalProduct(quantity: string, price: string): string {
  const parse = (value: string) => {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match) throw new Error("Unexpected decimal value from owner API");
    const fraction = match[3] ?? "";
    return {
      negative: match[1] === "-",
      digits: BigInt(`${match[2]}${fraction}`),
      scale: fraction.length,
    };
  };
  const left = parse(quantity);
  const right = parse(price);
  const product = left.digits * right.digits;
  const scale = left.scale + right.scale;
  const absolute = product.toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? absolute : absolute.slice(0, -scale);
  const fraction = scale === 0 ? "" : absolute.slice(-scale).replace(/0+$/, "");
  const value = fraction ? `${whole}.${fraction}` : whole;
  return (left.negative !== right.negative && product !== 0n ? "-" : "") + value;
}