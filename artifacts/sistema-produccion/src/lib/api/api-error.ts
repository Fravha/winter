export type WinterApiError = {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export class ApiError extends Error {
  public status: number;
  public code: string;
  public requestId?: string;
  public details?: unknown;

  constructor(error: WinterApiError) {
    super(error.message);
    this.name = 'ApiError';
    this.status = error.status;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
  }
}
