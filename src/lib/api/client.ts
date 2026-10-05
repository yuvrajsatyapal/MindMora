import { z } from "zod";
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.uuid(),
  }),
});
const messages: Record<string, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  revision_conflict: "This note changed on the server. Your draft is retained.",
  not_found: "This note is unavailable.",
  rate_limited: "Too many requests. Wait before retrying.",
  idempotency_conflict:
    "This create operation cannot be reused. Your draft is retained.",
  invalid_request: "Check the title and content limits.",
  service_unavailable: "The service is unavailable. Your draft is retained.",
};
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly correlationId?: string,
    readonly retryAfter?: number,
  ) {
    super(
      messages[code] ??
        "Request could not be confirmed. Your draft is retained.",
    );
  }
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new ApiError("uncertain");
  }
  if (!response.ok) {
    const parsed = errorSchema.safeParse(
      await response.json().catch(() => null),
    );
    const retry = Number(response.headers.get("retry-after"));
    throw new ApiError(
      parsed.success ? parsed.data.error.code : "request_failed",
      response.status,
      parsed.success ? parsed.data.error.correlationId : undefined,
      retry > 0 ? retry : undefined,
    );
  }
  try {
    return schema.parse(await response.json());
  } catch {
    throw new ApiError("uncertain", response.status);
  }
}
