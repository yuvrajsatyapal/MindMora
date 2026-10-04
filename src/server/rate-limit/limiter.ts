import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { assertVerifiedOwner, type VerifiedOwner } from "../db/user-context";
import { HttpFailure } from "../http/errors";
import { redisCounter, type Counter } from "./client";
export const authBudgets = {
  start: 10,
  callback: 20,
  session: 120,
  logout: 30,
} as const;
export function publicIdentity(
  request: Request,
  trustedHeader: "none" | "x-real-ip" = "none",
) {
  if (trustedHeader === "none") return "shared";
  const value = request.headers.get(trustedHeader);
  if (!value || !isIP(value)) return "shared";
  // Canonicalize IPv6 aliases; reject chains/ports rather than extracting a spoofable value.
  return isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname : value;
}
function key(scope: string, identity: string) {
  return `mindmora:limit:v1:${scope}:${createHash("sha256").update(identity).digest("hex")}`;
}
export function createLimiter(counter: Counter = redisCounter, now = Date.now) {
  const local = new Map<string, { count: number; expires: number }>();
  async function admit(
    scope: string,
    identity: string,
    limit: number,
    fallback: boolean,
  ) {
    const counterKey = key(scope, identity);
    try {
      const result = await counter(counterKey, 60_000);
      if (result.count > limit)
        throw new HttpFailure("rate_limited", result.ttlMs / 1000);
      return { degraded: false };
    } catch (error) {
      if (error instanceof HttpFailure) throw error;
      if (!fallback) throw new HttpFailure("admission_unavailable", 5);
      const time = now();
      for (const [entry, value] of local)
        if (value.expires <= time) local.delete(entry);
      let value = local.get(counterKey);
      if (!value) {
        if (local.size >= 1000)
          throw new HttpFailure("admission_unavailable", 60);
        value = { count: 0, expires: time + 60_000 };
        local.set(counterKey, value);
      }
      value.count++;
      if (value.count > 10)
        throw new HttpFailure("rate_limited", (value.expires - time) / 1000);
      return { degraded: true };
    }
  }
  return {
    auth: (action: keyof typeof authBudgets, identity: string) =>
      admit(`auth.${action}`, identity, authBudgets[action], false),
    basic: (owner: VerifiedOwner) => {
      assertVerifiedOwner(owner);
      return admit("basic", owner.userId, 60, true);
    },
    expensive: (owner: VerifiedOwner) => {
      assertVerifiedOwner(owner);
      return admit("expensive", owner.userId, 5, false);
    },
  };
}
export const limiter = createLimiter();
