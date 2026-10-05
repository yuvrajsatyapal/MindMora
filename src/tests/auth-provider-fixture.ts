import { createHash, randomUUID } from "node:crypto";

export const fixtureUser = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "learner@example.test",
  email_confirmed_at: "2026-10-04T00:00:00Z",
  phone: "",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "MindMora Learner", private: "provider-marker" },
  identities: [],
  created_at: "2026-10-04T00:00:00Z",
  updated_at: "2026-10-04T00:00:00Z",
  is_anonymous: false,
};

/** Test-only provider transport. It exercises the real SDK, not real Google/Supabase. */
export function authProviderFixture() {
  let currentUser = fixtureUser;
  const codes = new Map<string, { challenge: string; user: typeof fixtureUser }>();
  const tokens = new Map<string, { sessionId: string; exp: number; user: typeof fixtureUser }>();
  const refreshes = new Map<string, string>();
  const rotated = new Map<string, ReturnType<typeof issue>>();
  const revoked = new Set<string>();
  let unavailable = false;
  let failRefresh = false;
  let expired = false;
  const calls: string[] = [];
  function issue(sessionId: string = randomUUID(), user = currentUser) {
    const exp = Math.floor(Date.now() / 1000) + (expired ? -30 : 3600);
    const access = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp, session_id: sessionId })).toString("base64url")}.${randomUUID()}`;
    const refresh = `refresh-marker-${randomUUID()}`;
    tokens.set(access, { sessionId, exp, user });
    refreshes.set(refresh, sessionId);
    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: expired ? -30 : 3600,
      expires_at: exp,
      token_type: "bearer",
      user,
      provider_token: "google-private-marker",
      provider_refresh_token: "google-refresh-private-marker",
    };
  }
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.pathname + url.search);
    if (unavailable)
      return Response.json(
        { message: "private-provider-error-marker" },
        { status: 503 },
      );
    const headers = new Headers(init?.headers);
    const access = headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname.endsWith("/token")) {
      const data = body as Record<string, string>;
      if (url.searchParams.get("grant_type") === "pkce") {
        const challenge = createHash("sha256")
          .update(data.code_verifier ?? "")
          .digest("base64url");
        if (!data.auth_code || codes.get(data.auth_code)?.challenge !== challenge)
          return Response.json(
            { message: "private-code-marker", code: "bad_code_verifier" },
            { status: 400 },
          );
        const user = codes.get(data.auth_code)!.user;
        codes.delete(data.auth_code);
        return Response.json(issue(undefined, user));
      }
      const sessionId = refreshes.get(data.refresh_token);
      if (failRefresh || !sessionId || revoked.has(sessionId))
        return Response.json(
          {
            message: "private-refresh-marker",
            code: "refresh_token_not_found",
          },
          { status: 400 },
        );
      // Model the documented active-parent reuse exception for concurrent request fixtures.
      const previous = rotated.get(data.refresh_token);
      if (previous) return Response.json(previous);
      const user = [...tokens.values()].find((token) => token.sessionId === sessionId)!.user;
      const next = issue(sessionId, user);
      rotated.set(data.refresh_token, next);
      return Response.json(next);
    }
    if (url.pathname.endsWith("/user")) {
      const token = tokens.get(access);
      if (
        !token ||
        revoked.has(token.sessionId) ||
        token.exp <= Math.floor(Date.now() / 1000)
      )
        return Response.json(
          { message: "private-user-marker" },
          { status: 401 },
        );
      return Response.json(token.user);
    }
    if (url.pathname.endsWith("/logout")) {
      const token = tokens.get(access);
      if (!token) return Response.json({ message: "invalid" }, { status: 401 });
      if (url.searchParams.get("scope") === "local")
        revoked.add(token.sessionId);
      else
        for (const session of tokens.values()) revoked.add(session.sessionId);
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: "unexpected endpoint" }, { status: 404 });
  };
  return {
    fetcher,
    calls,
    selectUser(second: boolean) {
      currentUser = second ? { ...fixtureUser, id: "22222222-2222-4222-8222-222222222222", email: "second@example.test", user_metadata: { ...fixtureUser.user_metadata, full_name: "Second Learner" } } : fixtureUser;
    },
    authorize(authorizeUrl: string) {
      const url = new URL(authorizeUrl);
      const challenge = url.searchParams.get("code_challenge");
      if (
        !challenge ||
        url.searchParams.get("code_challenge_method") !== "s256"
      )
        throw new Error("Fixture requires S256 PKCE");
      const code = randomUUID();
      codes.set(code, { challenge, user: currentUser });
      const callback = new URL(url.searchParams.get("redirect_to")!);
      callback.searchParams.set("code", code);
      return callback.toString();
    },
    revoke() {
      for (const session of tokens.values()) revoked.add(session.sessionId);
    },
    outage() {
      unavailable = true;
    },
    rejectRefresh() {
      failRefresh = true;
    },
    expire() {
      expired = true;
    },
    issue,
  };
}
