import "server-only";
import { NextResponse } from "next/server";
import { getAuthConfig, type AuthConfig } from "../config";
import { AuthFailure, createAuthProvider } from "./provider";
import {
  clearSession,
  cookieName,
  decodeCookie,
  matchesState,
  newState,
  pendingSchema,
  readCookie,
  verifySession,
  writeCookie,
} from "./session";
export type AuthAction = "start" | "callback" | "session" | "logout";

function response(status: number, code?: string) {
  const result = code
    ? NextResponse.json(
        {
          error: {
            code,
            message:
              code === "unauthenticated"
                ? "Authentication required."
                : "Authentication request could not be completed.",
          },
        },
        { status },
      )
    : new NextResponse(null, { status });
  result.headers.set("Cache-Control", "private, no-store");
  result.headers.set("Pragma", "no-cache");
  result.headers.set("Expires", "0");
  result.headers.set("Referrer-Policy", "no-referrer");
  return result;
}
function redirect(location: string) {
  const result = response(303);
  result.headers.set("Location", location);
  return result;
}

export async function handleAuth(
  action: AuthAction,
  request: Request,
  deps?: { config: AuthConfig; fetcher?: typeof fetch },
): Promise<Response> {
  let config: AuthConfig;
  try {
    config = deps?.config ?? getAuthConfig();
  } catch {
    return response(503, "auth_unavailable");
  }
  const url = new URL(request.url);
  const mutation = action === "start" || action === "logout";
  const supportedMethod = mutation ? "POST" : "GET";
  if (request.method !== supportedMethod) {
    const denied = response(405, "method_not_allowed");
    denied.headers.set("Allow", supportedMethod);
    return denied;
  }
  const origin = request.headers.get("origin");
  if (
    action !== "callback" &&
    ((mutation && origin !== config.appOrigin) ||
      (origin && origin !== config.appOrigin) ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return response(403, "origin_rejected");
  if (action !== "callback" && url.search)
    return response(400, "invalid_auth_request");
  const pending = pendingSchema.safeParse(
    decodeCookie(readCookie(request, cookieName(config.appOrigin, "pending"))),
  );
  if (action === "callback") {
    const allowed = [
      "state",
      "code",
      "error",
      "error_description",
      "error_code",
    ];
    const invalid = [...url.searchParams.keys()].some(
      (key) =>
        !allowed.includes(key) || url.searchParams.getAll(key).length !== 1,
    );
    const code = url.searchParams.get("code");
    if (
      invalid ||
      url.searchParams.has("error") ||
      !code ||
      code.length > 2048 ||
      !pending.success ||
      pending.data.expiresAt <= Date.now() ||
      !matchesState(pending.data.state, url.searchParams.get("state"))
    ) {
      const denied = response(400, "invalid_auth_callback");
      writeCookie(denied, config.appOrigin, "pending", null, 0);
      return denied;
    }
  }
  const provider = createAuthProvider(
    config,
    deps?.fetcher,
    action === "callback" && pending.success ? pending.data.storage : undefined,
  );
  try {
    if (action === "start") {
      const state = newState();
      const callback = new URL("/api/auth/callback", config.appOrigin);
      callback.searchParams.set("state", state);
      const start = await provider.start(callback.toString());
      const authorize = new URL(start.url);
      if (
        authorize.origin !== config.supabaseUrl ||
        authorize.pathname !== "/auth/v1/authorize"
      )
        throw new AuthFailure("unavailable");
      const result = redirect(start.url);
      writeCookie(
        result,
        config.appOrigin,
        "pending",
        {
          state,
          expiresAt: Date.now() + 600_000,
          flowId: start.flowId,
          storage: start.storage,
        },
        600,
      );
      return result;
    }
    if (action === "callback" && pending.success) {
      const session = await provider.exchange(
        url.searchParams.get("code")!,
        pending.data.flowId,
      );
      await provider.verify(session.accessToken);
      const result = redirect(new URL("/", config.appOrigin).toString());
      writeCookie(
        result,
        config.appOrigin,
        "session",
        session,
        60 * 60 * 24 * 7,
      );
      writeCookie(result, config.appOrigin, "pending", null, 0);
      return result;
    }
    const raw = decodeCookie(
      readCookie(request, cookieName(config.appOrigin, "session")),
    );
    if (action === "logout" && raw === null) {
      const result = response(204);
      clearSession(result, config.appOrigin);
      return result;
    }
    const verified = await verifySession(raw, provider);
    if (action === "logout") {
      await provider.revoke(verified.tokens.accessToken);
      const result = response(204);
      clearSession(result, config.appOrigin);
      return result;
    }
    const result = NextResponse.json(verified.projection);
    for (const [key, value] of response(200).headers)
      result.headers.set(key, value);
    if (verified.refreshed)
      writeCookie(
        result,
        config.appOrigin,
        "session",
        verified.tokens,
        60 * 60 * 24 * 7,
      );
    return result;
  } catch (error) {
    const unauthenticated =
      error instanceof AuthFailure && error.kind === "unauthenticated";
    const result = response(
      unauthenticated ? 401 : 503,
      unauthenticated ? "unauthenticated" : "auth_unavailable",
    );
    if (action === "logout" || unauthenticated)
      clearSession(result, config.appOrigin);
    if (action === "callback")
      writeCookie(result, config.appOrigin, "pending", null, 0);
    return result;
  } finally {
    await provider.dispose();
  }
}
