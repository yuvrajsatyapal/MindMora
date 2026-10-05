/** The browser may execute only the application API, even if Swagger input is edited. */
export function docsEnabled(
  environment: string | undefined,
  optIn: string | undefined,
) {
  return environment === "development" || optIn === "true";
}
export type DocsRequest = {
  url: string;
  method?: string;
  credentials?: string;
  headers?: Record<string, string>;
};
export function sameOriginRequest(
  request: DocsRequest,
  origin: string,
): DocsRequest {
  const target = new URL(request.url, origin);
  if (
    target.origin !== origin ||
    !target.pathname.startsWith("/api/") ||
    target.username ||
    target.password
  )
    throw new Error(
      "API documentation requests must use the current application origin.",
    );
  const pathname = target.pathname.replace(/\/+$/, "");
  // Redirecting OAuth endpoints require top-level app navigation, not an API console fetch.
  if (pathname === "/api/auth/start" || pathname === "/api/auth/callback")
    throw new Error(
      "Use the application sign-in flow for Google authentication.",
    );
  return { ...request, url: target.href, credentials: "same-origin" };
}
