import { AppError } from "../errors/app-error.js";

export const MAX_REPORT_ROWS = 25_000;
export const MAX_REPORT_ROOT_RECORDS = 1_000;
export const MAX_REPORT_RELATED_RECORDS = 25;

export function assertReportRecordLimit(
  count: number,
  limit: number,
  scope: string,
): void {
  if (count > limit) {
    throw new AppError(
      "REPORT_RESULT_TOO_LARGE",
      `The ${scope} result exceeds the supported limit of ${limit} records. Narrow the filters and retry; no rows were truncated.`,
      413,
    );
  }
}