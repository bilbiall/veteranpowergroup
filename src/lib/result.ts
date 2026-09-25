import { isAppError } from "./errors";
import { logger } from "./logger";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export function success<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function failure(error: unknown): ActionResult<never> {
  if (isAppError(error)) {
    return { success: false, error: { code: error.code, message: error.message, details: error.details } };
  }

  logger.error("Unhandled application error", { error });
  return { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } };
}

export async function runServerAction<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return success(await action());
  } catch (error) {
    return failure(error);
  }
}
