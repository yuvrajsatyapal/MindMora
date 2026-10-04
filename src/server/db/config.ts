import "server-only";
import { readFileSync } from "node:fs";
import { z } from "zod";
const databaseUrl = z
  .string()
  .max(4096)
  .refine((value) => {
    try {
      const url = new URL(value);
      decodeURIComponent(url.username);
      decodeURIComponent(url.password);
      return (
        ["postgres:", "postgresql:"].includes(url.protocol) &&
        !!url.hostname &&
        !!url.username &&
        !!url.password &&
        url.pathname.length > 1 &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  });
export type DatabaseConfig = Readonly<{
  url: string;
  max: number;
  ssl: boolean;
  ca?: string;
}>;
function read(
  env: Record<string, string | undefined>,
  key: string,
  runtime: boolean,
): DatabaseConfig {
  const parsed = databaseUrl.safeParse(env[key]);
  const max = z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .safeParse(env.DATABASE_POOL_MAX ?? "3");
  if (!parsed.success || !max.success)
    throw new Error("Invalid server configuration: database.");
  const url = new URL(parsed.data);
  if (
    runtime &&
    !/^mindmora_app(?:\.[a-z0-9]+)?$/.test(decodeURIComponent(url.username))
  )
    throw new Error("Invalid server configuration: database.");
  let ca: string | undefined;
  if (env.DATABASE_CA_CERT_PATH) {
    try {
      ca = readFileSync(env.DATABASE_CA_CERT_PATH, "utf8");
      if (!ca.includes("-----BEGIN CERTIFICATE-----") || ca.length > 65536)
        throw new Error();
    } catch {
      throw new Error("Invalid server configuration: database certificate.");
    }
  }
  return Object.freeze({
    ca,
    url: parsed.data,
    max: runtime ? max.data : 1,
    ssl: !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
  });
}
export const getDatabaseConfig = (
  env: Record<string, string | undefined> = process.env,
) => read(env, "DATABASE_URL", true);
export const getMigrationConfig = (
  env: Record<string, string | undefined> = process.env,
) => read(env, "MIGRATION_DATABASE_URL", false);
