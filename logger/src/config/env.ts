import "dotenv/config";
import { z } from "zod";

const booleanFromString = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() === "true" : value),
  z.boolean(),
);
const optionalBlank = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  WINTER_DATABASE_URL: z.string().min(1),
  FIREBASE_WEB_API_KEY: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).transform((value) => value.replace(/\\n/g, "\n")),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  TRUST_PROXY: booleanFromString.default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SUPABASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: optionalBlank,
  ATTACHMENTS_BUCKET: z.string().min(1).default("winter-attachments"),
  ATTACHMENTS_SIGNED_URL_SECONDS: z.coerce.number().int().positive().default(300),
});

export function parseAppEnv(input: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return {
    ...result.data,
    corsOrigins: result.data.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export const env = parseAppEnv(process.env);

export type AppConfig = typeof env;
