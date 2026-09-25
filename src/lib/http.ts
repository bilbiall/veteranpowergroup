import { NextResponse } from "next/server";
import { isAppError } from "./errors";
import { logger } from "./logger";

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function apiFailure(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode },
    );
  }

  logger.error("Unhandled API error", { error });
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}

export function withApiErrorHandling<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiFailure(error);
    }
  };
}
