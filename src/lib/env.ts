import { z } from "zod";

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
  if (value.PROTOTYPE_SESSION_SECRET.startsWith("replace-with-")) {
    context.addIssue({ code: "custom", path: ["PROTOTYPE_SESSION_SECRET"], message: "Set a unique session secret" });
  }
});

export const env = envSchema.parse(process.env);
