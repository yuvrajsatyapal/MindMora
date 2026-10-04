import "server-only";
import { createClient } from "redis";
import { getRateLimitConfig, type RateLimitConfig } from "../config";
// One atomic window relative to first request. TTL is repaired if unexpectedly missing.
export const COUNTER_SCRIPT = `local n = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {n, ttl}`;
export type Counter = (
  key: string,
  windowMs: number,
) => Promise<{ count: number; ttlMs: number }>;
export function createRedisCounter(config: RateLimitConfig) {
  let client: ReturnType<typeof createClient> | undefined;
  let connecting: Promise<unknown> | undefined;
  let unavailableUntil = 0;
  const counter: Counter = async (key, windowMs) => {
    if (Date.now() < unavailableUntil)
      throw new Error("Admission unavailable.");
    if (!client) {
      client = createClient({
        url: config.redisUrl,
        disableOfflineQueue: true,
        socket: { connectTimeout: 1000, reconnectStrategy: false },
      });
      client.on("error", () => {});
    }
    const current = client; // Raw transport errors must never reach logs.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = async () => {
        if (!current.isReady) {
          connecting ??= current.connect().finally(() => {
            connecting = undefined;
          });
          await connecting;
        }
        const result: unknown = await current.eval(COUNTER_SCRIPT, {
          keys: [key],
          arguments: [String(windowMs)],
        });
        if (
          !Array.isArray(result) ||
          result.length !== 2 ||
          !Number.isSafeInteger(result[0]) ||
          result[0] < 1 ||
          !Number.isSafeInteger(result[1]) ||
          result[1] < 0
        )
          throw new Error("Admission unavailable.");
        return { count: result[0] as number, ttlMs: result[1] as number };
      };
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Admission unavailable.")),
            1500,
          );
        }),
      ]);
    } catch {
      unavailableUntil = Date.now() + 5000;
      if (current.isOpen) current.destroy();
      if (client === current) client = undefined;
      throw new Error("Admission unavailable.");
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    counter,
    close: () => {
      if (client?.isOpen) client.destroy();
      client = undefined;
    },
  };
}
let shared: ReturnType<typeof createRedisCounter> | undefined;
export const redisCounter: Counter = async (key, windowMs) => {
  shared ??= createRedisCounter(getRateLimitConfig());
  return shared.counter(key, windowMs);
};
