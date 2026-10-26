import { z } from "zod";

const fallbackDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5433/veteranpowergroup";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
      message: "DATABASE_URL must be a PostgreSQL connection string",
    })
    .default(fallbackDatabaseUrl),
  PROTOTYPE_ADMIN_EMAIL: z.string().email().default("admin@veteranpowergroup.local"),
  PROTOTYPE_ADMIN_PASSWORD: z.string().min(8).default("change-me-please"),
  PROTOTYPE_SESSION_SECRET: z.string().min(32).default("development-session-secret-change-me-please"),
}).superRefine((value, context) => {
  if (value.PROTOTYPE_SESSION_SECRET.startsWith("replace-with-")) {
    context.addIssue({ code: "custom", path: ["PROTOTYPE_SESSION_SECRET"], message: "Set a unique session secret" });
  }
});

export const env = envSchema.parse({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  PROTOTYPE_ADMIN_EMAIL: process.env.PROTOTYPE_ADMIN_EMAIL ?? "admin@veteranpowergroup.local",
  PROTOTYPE_ADMIN_PASSWORD: process.env.PROTOTYPE_ADMIN_PASSWORD ?? "change-me-please",
  PROTOTYPE_SESSION_SECRET: process.env.PROTOTYPE_SESSION_SECRET ?? "development-session-secret-change-me-please",
});
