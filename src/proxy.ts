import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { workspacePolicy } from "./server/http/content-security-policy";
export function proxy(request: NextRequest) {
  // Never accept a browser-selected nonce. Next reads the request CSP for its scripts.
  const nonce = randomBytes(18).toString("base64");
  let oauthOrigin: string | undefined;
  try { oauthOrigin = new URL(process.env.SUPABASE_URL ?? "").origin; } catch { /* Missing config does not authorize an external form. */ }
  const policy = workspacePolicy(nonce, process.env.NODE_ENV === "development", oauthOrigin);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}
export const config = { matcher: "/workspace/:path*" };
