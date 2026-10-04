import "server-only";
import pino, { type DestinationStream } from "pino";
import { z } from "zod";
const metadata = z.object({
  correlationId: z.uuid(),
  operation: z.enum([
    "auth.start",
    "auth.callback",
    "auth.session",
    "auth.logout",
  ]),
  status: z.number().int().min(100).max(599),
  durationMs: z.number().finite().nonnegative(),
  errorCode: z
    .enum([
      "invalid_request",
      "unauthenticated",
      "origin_rejected",
      "forbidden",
      "not_found",
      "method_not_allowed",
      "revision_conflict",
      "payload_too_large",
      "unsupported_media_type",
      "rate_limited",
      "auth_unavailable",
      "admission_unavailable",
      "service_unavailable",
      "internal_error",
      "invalid_auth_request",
      "invalid_auth_callback",
    ])
    .optional(),
});
export function createRequestLogger(destination?: DestinationStream) {
  const logger = pino(
    {
      base: undefined,
      redact: {
        paths: [
          "req",
          "res",
          "err",
          "body",
          "title",
          "content",
          "cookie",
          "authorization",
          "accessToken",
          "refreshToken",
          "token",
          "key",
          "url",
          "signedUrl",
          "payload",
        ],
        remove: true,
      },
    },
    destination,
  );
  // Only this facade is exported: no free-form messages, raw errors or arbitrary fields.
  return (input: unknown) => {
    const result = metadata.safeParse(input);
    if (result.success) logger.info(result.data, "request completed");
  };
}
let requestLogger: ReturnType<typeof createRequestLogger> | undefined;
export function logRequest(input: unknown) {
  requestLogger ??= createRequestLogger();
  requestLogger(input);
}
