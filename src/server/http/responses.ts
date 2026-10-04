import "server-only";
import { NextResponse } from "next/server";
import { safeFailure, type ErrorCode } from "./errors";
const errorCodes = new WeakMap<Response, ErrorCode>();
export function responseErrorCode(response: Response) {
  return errorCodes.get(response);
}
export function privateResponse(
  response: NextResponse,
  correlationId?: string,
) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (correlationId) response.headers.set("X-Request-ID", correlationId);
  return response;
}
export function errorResponse(error: unknown, correlationId: string) {
  const failure = safeFailure(error);
  const response = privateResponse(
    NextResponse.json(
      {
        error: {
          code: failure.code,
          message: failure.message,
          correlationId,
        },
      },
      { status: failure.status },
    ),
    correlationId,
  );
  errorCodes.set(response, failure.code);
  if (failure.retryAfter !== undefined)
    response.headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil(failure.retryAfter))),
    );
  return response;
}
