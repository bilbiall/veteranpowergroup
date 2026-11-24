import { z } from "zod";
import "server-only";

const fallbackDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5433/veteranpowergroup";
const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
      message: "DATABASE_URL must be a PostgreSQL connection string",
    }),
  PROTOTYPE_ADMIN_EMAIL: z.string().email(),
  PROTOTYPE_ADMIN_PASSWORD: z.string().min(8),
  PROTOTYPE_SESSION_SECRET: z.string().min(32),
}).superRefine((value, context) => {
  if (value.PROTOTYPE_SESSION_SECRET.startsWith("replace-with-") || (value.NODE_ENV === "production" && value.PROTOTYPE_SESSION_SECRET === "development-session-secret-change-me-please")) {
    context.addIssue({ code: "custom", path: ["PROTOTYPE_SESSION_SECRET"], message: "Set a unique session secret" });
  }
  if (value.NODE_ENV === "production" && value.PROTOTYPE_ADMIN_PASSWORD === "change-me-please") {
    context.addIssue({ code: "custom", path: ["PROTOTYPE_ADMIN_PASSWORD"], message: "Set a unique production admin password" });
  }
  if (value.NODE_ENV === "production" && value.PROTOTYPE_ADMIN_PASSWORD.length < 16) {
    context.addIssue({ code: "custom", path: ["PROTOTYPE_ADMIN_PASSWORD"], message: "Use a production admin password of at least 16 characters" });
  }
});

const sourceEnv = {
  ...process.env,
  ...(!isProduction && !process.env.DATABASE_URL ? { DATABASE_URL: fallbackDatabaseUrl } : {}),
  ...(!isProduction && !process.env.PROTOTYPE_ADMIN_EMAIL ? { PROTOTYPE_ADMIN_EMAIL: "admin@veteranpowergroup.local" } : {}),
  ...(!isProduction && !process.env.PROTOTYPE_ADMIN_PASSWORD ? { PROTOTYPE_ADMIN_PASSWORD: "change-me-please" } : {}),
  ...(!isProduction && !process.env.PROTOTYPE_SESSION_SECRET ? { PROTOTYPE_SESSION_SECRET: "development-session-secret-change-me-please" } : {}),
};

export const env = envSchema.parse(sourceEnv);
