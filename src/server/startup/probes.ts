import "server-only";
import { createClient } from "redis";
import postgres from "postgres";
import { getRateLimitConfig } from "../config";
import { getDatabaseConfig } from "../db/config";
const messages = {
  configuration: "Configuration is missing or invalid.",
  timeout: "Connection check timed out.",
  connection: "Connection could not be established.",
} as const;
class ProbeFailure extends Error {
  constructor(readonly reason: keyof typeof messages) {
    super(messages[reason]);
  }
}
export function safeProbeMessage(error: unknown) {
  return error instanceof ProbeFailure && Object.hasOwn(messages, error.reason)
    ? messages[error.reason]
    : messages.connection;
}
async function deadline<T>(work: PromiseLike<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProbeFailure("timeout")), 5000);
      }),
    ]);
  } catch (error) {
    throw error instanceof ProbeFailure
      ? error
      : new ProbeFailure("connection");
  } finally {
    clearTimeout(timer);
  }
}
/** Dedicated startup client; PING stores no state and never initializes the request limiter. */
export async function probeRedis(
  env: Record<string, string | undefined> = process.env,
) {
  let config;
  try {
    config = getRateLimitConfig(env);
  } catch {
    throw new ProbeFailure("configuration");
  }
  const client = createClient({
    url: config.redisUrl,
    disableOfflineQueue: true,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });
  client.on("error", () => {});
  try {
    await deadline(
      (async () => {
        await client.connect();
        if ((await client.ping()) !== "PONG")
          throw new ProbeFailure("connection");
      })(),
    );
  } finally {
    if (client.isOpen) client.destroy();
  }
}
/** Connectivity only; no owner claims, note reads or privileged migration credential. */
export async function probePostgreSQL(
  env: Record<string, string | undefined> = process.env,
) {
  let config;
  try {
    config = getDatabaseConfig(env);
  } catch {
    throw new ProbeFailure("configuration");
  }
  const connection = postgres(config.url, {
    prepare: false,
    max: 1,
    ssl: config.ssl ? { rejectUnauthorized: true, ca: config.ca } : false,
    connect_timeout: 3,
    idle_timeout: 1,
    onnotice: () => {},
  });
  try {
    const result = await deadline(connection`SELECT 1 AS ok`);
    if (result[0]?.ok !== 1) throw new ProbeFailure("connection");
  } finally {
    await connection.end({ timeout: 0 });
  }
}
