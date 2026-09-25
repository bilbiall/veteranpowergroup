import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((value) => value.startsWith("file:"), {
      message: "DATABASE_URL must be a SQLite file URL for this prototype",
    }),
  PROTOTYPE_ADMIN_EMAIL: z.string().email().default("admin@northstar.local"),
  PROTOTYPE_ADMIN_PASSWORD: z.string().min(12).default("LocalDemoOnly2026!"),
  PROTOTYPE_SESSION_SECRET: z.string().min(32).default("local-prototype-session-secret-change-before-deploy"),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production") {
    for (const key of ["PROTOTYPE_ADMIN_EMAIL", "PROTOTYPE_ADMIN_PASSWORD", "PROTOTYPE_SESSION_SECRET"] as const) {
      if (!process.env[key]) {
        context.addIssue({ code: "custom", path: [key], message: `${key} must be explicitly configured in production` });
      }
    }
    if (value.PROTOTYPE_SESSION_SECRET.startsWith("replace-with-") || value.PROTOTYPE_SESSION_SECRET === "local-prototype-session-secret-change-before-deploy") {
      context.addIssue({ code: "custom", path: ["PROTOTYPE_SESSION_SECRET"], message: "Set a unique session secret in production" });
    }
    if (value.PROTOTYPE_ADMIN_EMAIL === "admin@northstar.local" || value.PROTOTYPE_ADMIN_PASSWORD === "LocalDemoOnly2026!") {
      context.addIssue({ code: "custom", path: ["PROTOTYPE_ADMIN_EMAIL"], message: "Replace the local prototype credentials before production" });
    }
  }
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
});
