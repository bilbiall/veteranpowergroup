type LogContext = Record<string, unknown>;

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
};

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    const error: SerializedError = { name: value.name, message: value.message };
    if (value.stack) error.stack = value.stack;
    return error;
  }

  return value;
}

function write(level: "debug" | "info" | "warn" | "error", message: string, context?: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? Object.fromEntries(Object.entries(context).map(([key, value]) => [key, serialize(value)])) : {}),
  };

  const output = JSON.stringify(payload);
  if (level === "error") return console.error(output);
  if (level === "warn") return console.warn(output);
  if (level === "debug") return console.debug(output);
  return console.info(output);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
