import "server-only";
import { getAuthConfig, type AuthConfig } from "../config";
import { createAuthProvider, AuthFailure } from "../auth/provider";
import {
  cookieName,
  readCookie,
  decodeCookie,
  verifySession,
} from "../auth/session";
const verified = new WeakSet<object>();
export type VerifiedOwner = Readonly<{ userId: string }>;
/** Only an online-verified Supabase identity can enter a database transaction. */
export async function verifyDatabaseSession(
  request: Request,
  options: { config?: AuthConfig; fetcher?: typeof fetch } = {},
) {
  const config = options.config ?? getAuthConfig();
  const session = await verifySession(
    decodeCookie(readCookie(request, cookieName(config.appOrigin, "session"))),
    createAuthProvider(config, options.fetcher),
  );
  const owner = Object.freeze({ userId: session.projection.user.id });
  verified.add(owner);
  return { ...session, owner };
}
export function assertVerifiedOwner(owner: VerifiedOwner) {
  if (!verified.has(owner)) throw new AuthFailure("unauthenticated");
}
