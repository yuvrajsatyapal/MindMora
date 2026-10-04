import "server-only";
import { HttpFailure } from "./errors";
/** OAuth callbacks instead require the browser-bound state/PKCE checks. */
export function assertOrigin(
  request: Request,
  appOrigin: string,
  mutation: boolean,
) {
  const origin = request.headers.get("origin");
  if (
    (mutation && origin !== appOrigin) ||
    (origin !== null && origin !== appOrigin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpFailure("origin_rejected");
}
