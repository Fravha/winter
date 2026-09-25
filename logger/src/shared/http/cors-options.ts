import type { CorsOptions } from "cors";

export function createCorsOptions(origins: readonly string[]): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition", "Content-Length"],
  };
}