import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { NextResponse } from "next/server";
import {
  AuthFailure,
  createAuthProvider,
  tokenSchema,
  type AuthTokens,
} from "./provider";

export const pendingSchema = z
  .object({
    state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: z.number().int().positive(),
    flowId: z.string().min(1).max(128),
    storage: z.record(z.string().max(256), z.string().max(1024)),
  })
  .strict();

export function cookieName(origin: string, purpose: "pending" | "session") {
  return `${origin.startsWith("https:") ? "__Host-" : ""}mindmora-${purpose}`;
}

export function readCookie(request: Request, name: string): string | undefined {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${name}=`));
  // Ambiguous/oversized cookies are untrusted and never select an identity.
  if (values.length !== 1 || values[0].length > 3900) return undefined;
  return values[0].slice(name.length + 1);
}

export function decodeCookie(value: string | undefined): unknown {
  try {
    return value
      ? JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
      : null;
  } catch {
    return null;
  }
}

export function writeCookie(
  response: NextResponse,
  origin: string,
  purpose: "pending" | "session",
  value: unknown,
  maxAge: number,
) {
  const encoded =
    value === null
      ? ""
      : Buffer.from(JSON.stringify(value)).toString("base64url");
  if (encoded.length > 3800) throw new AuthFailure("unavailable");
  response.cookies.set(cookieName(origin, purpose), encoded, {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearSession(response: NextResponse, origin: string) {
  for (const purpose of ["pending", "session"] as const)
    writeCookie(response, origin, purpose, null, 0);
}

export function newState() {
  return randomBytes(32).toString("base64url");
}
export function matchesState(expected: string, received: string | null) {
  if (
    !received ||
    !/^[A-Za-z0-9_-]{43}$/.test(received) ||
    expected.length !== received.length
  )
    return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function verifySession(
  raw: unknown,
  provider: ReturnType<typeof createAuthProvider>,
): Promise<{
  projection: Awaited<ReturnType<typeof provider.verify>>;
  tokens: AuthTokens;
  refreshed: boolean;
}> {
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) throw new AuthFailure("unauthenticated");
  let current = parsed.data;
  let refreshed = false;
  if (current.expiresAt <= Math.floor(Date.now() / 1000) + 30) {
    current = await provider.refresh(current.refreshToken);
    refreshed = true;
  }
  // Never authorize from cookie fields, decoded JWT claims or SDK getSession().
  const projection = await provider.verify(current.accessToken);
  return { projection, tokens: current, refreshed };
}
