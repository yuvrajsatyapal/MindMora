import "server-only";
const definitions = {
  invalid_request: [400, "Invalid request."],
  unauthenticated: [401, "Authentication required."],
  origin_rejected: [403, "Request origin rejected."],
  forbidden: [403, "Operation not permitted."],
  not_found: [404, "Record not found."],
  method_not_allowed: [405, "Method not allowed."],
  idempotency_conflict: [
    409,
    "Operation key already used with different input.",
  ],
  revision_conflict: [409, "Record changed; refresh before retrying."],
  payload_too_large: [413, "Request is too large."],
  unsupported_media_type: [415, "JSON content type required."],
  rate_limited: [429, "Too many requests."],
  auth_unavailable: [503, "Authentication unavailable."],
  admission_unavailable: [503, "Request admission unavailable."],
  service_unavailable: [503, "Service unavailable."],
  internal_error: [500, "Request could not be completed."],
  invalid_auth_request: [400, "Invalid authentication request."],
  invalid_auth_callback: [400, "Invalid authentication callback."],
} as const;
export type ErrorCode = keyof typeof definitions;
export class HttpFailure extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    readonly retryAfter?: number,
  ) {
    super(definitions[code][1]);
    this.status = definitions[code][0];
  }
}
export function safeFailure(error: unknown): HttpFailure {
  if (
    !(error instanceof HttpFailure) ||
    !Object.hasOwn(definitions, error.code)
  )
    return new HttpFailure("internal_error");
  const retry = error.retryAfter;
  return new HttpFailure(
    error.code,
    typeof retry === "number" && Number.isFinite(retry) && retry > 0
      ? retry
      : undefined,
  );
}
