import "server-only";
import { z } from "zod";
import { HttpFailure } from "./errors";
// JSON escaping can expand the 1 MiB note contract by up to six times.
export const JSON_BODY_MAX_BYTES = 6 * 1_048_576 + 8192;
export const REQUEST_HEADER_MAX_BYTES = 32_768;
export function assertRequestBounds(request: Request) {
  let size = 0;
  for (const [key, value] of request.headers)
    size += Buffer.byteLength(key + value);
  if (size > REQUEST_HEADER_MAX_BYTES || Buffer.byteLength(request.url) > 8192)
    throw new HttpFailure("payload_too_large");
}
export async function readBoundedBody(
  request: Request,
  maxBytes: number,
  timeoutMs = 2000,
) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new HttpFailure(
      /^\d+$/.test(length) ? "payload_too_large" : "invalid_request",
    );
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpFailure("invalid_request"));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new HttpFailure("payload_too_large");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error instanceof HttpFailure
      ? error
      : new HttpFailure("invalid_request");
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = JSON_BODY_MAX_BYTES,
): Promise<T> {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new HttpFailure("unsupported_media_type");
  const bytes = await readBoundedBody(request, maxBytes);
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    const result = schema.safeParse(parsed);
    if (!result.success) throw new HttpFailure("invalid_request");
    return result.data;
  } catch {
    throw new HttpFailure("invalid_request");
  }
}
