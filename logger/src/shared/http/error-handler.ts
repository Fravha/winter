import type { ErrorRequestHandler } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { AppError } from "../errors/app-error.js";

const sensitiveKey = /(?:prisma|sql|stack|secret|token|password|credential|authorization|requesthash|url|internal)/i;
const sensitiveValue = /(?:prisma|select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from|postgres(?:ql)?|supabase|https?:\/\/|Bearer\s+\S+|requesthash)/i;

function sanitizeDetails(value: unknown): unknown {
  if (typeof value === "string") return sensitiveValue.test(value) ? undefined : value;
  if (Array.isArray(value)) {
    const safe = value.map(sanitizeDetails).filter((item) => item !== undefined);
    return safe.length > 0 ? safe : undefined;
  }
  if (value && typeof value === "object") {
    const safe = Object.fromEntries(Object.entries(value)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, item]) => [key, sanitizeDetails(item)])
      .filter(([, item]) => item !== undefined));
    return Object.keys(safe).length > 0 ? safe : undefined;
  }
  return value;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = error instanceof AppError
    ? error
    : new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  const safeDetails = appError.details !== undefined && env.NODE_ENV !== "production"
    ? sanitizeDetails(appError.details)
    : undefined;

  const log = appError.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      requestId: req.requestId,
    },
    "request failed",
  );

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      requestId: req.requestId,
      ...(safeDetails !== undefined ? { details: safeDetails } : {}),
    },
  });
};
