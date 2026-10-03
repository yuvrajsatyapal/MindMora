import "server-only";
import { AuthClient, type Session } from "@supabase/auth-js";
import { z } from "zod";
import type { AuthConfig } from "../config";
import { sessionProjectionSchema } from "../../features/account/types";

export class AuthFailure extends Error {
  constructor(readonly kind: "unauthenticated" | "unavailable") {
    super(
      kind === "unauthenticated"
        ? "Authentication required."
        : "Authentication unavailable.",
    );
  }
}

export const tokenSchema = z
  .object({
    accessToken: z.string().min(1).max(3500),
    refreshToken: z.string().min(1).max(512),
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type AuthTokens = z.infer<typeof tokenSchema>;

function tokens(session: Session | null): AuthTokens {
  const parsed = tokenSchema.safeParse(
    session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
        }
      : null,
  );
  if (!parsed.success) throw new AuthFailure("unavailable");
  return parsed.data;
}

function check(error: { status?: number } | null) {
  if (error)
    throw new AuthFailure(
      error.status &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
        ? "unauthenticated"
        : "unavailable",
    );
}

/** Each call owns its SDK/storage; nothing is shared between requests/users. */
export function createAuthProvider(
  config: AuthConfig,
  fetcher: typeof fetch = fetch,
  initialStorage: Record<string, string> = {},
) {
  const memory = new Map(Object.entries(initialStorage));
  const client = new AuthClient({
    url: `${config.supabaseUrl}/auth/v1`,
    headers: { apikey: config.publishableKey },
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "mindmora-auth",
    storage: {
      isServer: true,
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    },
    fetch: (input, init) =>
      fetcher(input, {
        ...init,
        cache: "no-store",
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000),
      }),
  });
  return {
    async start(redirectTo: string) {
      const { data, error } = await client.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: "openid email profile",
        },
      });
      check(error);
      if (!data.url || !data.flowId) throw new AuthFailure("unavailable");
      return {
        url: data.url,
        flowId: data.flowId,
        storage: Object.fromEntries(memory),
      };
    },
    async exchange(code: string, flowId: string) {
      const { data, error } = await client.exchangeCodeForSession(code, {
        flowId,
      });
      check(error);
      return tokens(data.session);
    },
    async refresh(refreshToken: string) {
      const { data, error } = await client.refreshSession({
        refresh_token: refreshToken,
      });
      check(error);
      return tokens(data.session);
    },
    async verify(accessToken: string) {
      const { data, error } = await client.getUser(accessToken);
      check(error);
      const user = data.user;
      if (!user) throw new AuthFailure("unauthenticated");
      const name: unknown = user.user_metadata?.full_name;
      const parsed = sessionProjectionSchema.safeParse({
        user: {
          id: user.id,
          email: user.email ?? null,
          displayName: typeof name === "string" ? name.slice(0, 200) : null,
        },
      });
      if (!parsed.success) throw new AuthFailure("unavailable");
      return parsed.data;
    },
    async revoke(accessToken: string) {
      // This supported API supplies the user's JWT, not a privileged/service-role credential.
      const { error } = await client.admin.signOut(accessToken, "local");
      check(error);
    },
    async dispose() {
      memory.clear();
      await client.dispose();
    },
  };
}
