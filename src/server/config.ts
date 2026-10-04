import "server-only";
import { z } from "zod";

const originSchema = z
  .url()
  .pipe(
    z.string().refine((value) => {
      const url = new URL(value);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname,
      );
      return (
        (url.protocol === "https:" || (url.protocol === "http:" && loopback)) &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    }),
  )
  .transform((value) => new URL(value).origin);

const configSchema = z.object({ APP_ORIGIN: originSchema });

/** Lazy validation keeps public specimens independent of backend setup. */
export function getServerConfig(
  env: Record<string, string | undefined> = process.env,
): Readonly<{ appOrigin: string }> {
  // Select known fields rather than carrying unrelated credentials into config/errors.
  const result = configSchema.safeParse({ APP_ORIGIN: env.APP_ORIGIN });
  if (!result.success) {
    // Do not attach the raw environment, Zod issues or an error cause.
    throw new Error("Invalid server configuration: APP_ORIGIN.");
  }
  return Object.freeze({ appOrigin: result.data.APP_ORIGIN });
}

const authConfigSchema = z.object({
  APP_ORIGIN: originSchema,
  SUPABASE_URL: originSchema,
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .max(200)
    .regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
});

export type AuthConfig = Readonly<{
  appOrigin: string;
  supabaseUrl: string;
  publishableKey: string;
}>;

export function getAuthConfig(
  env: Record<string, string | undefined> = process.env,
): AuthConfig {
  const result = authConfigSchema.safeParse({
    APP_ORIGIN: env.APP_ORIGIN,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success)
    throw new Error("Invalid server configuration: Supabase Auth.");
  return Object.freeze({
    appOrigin: result.data.APP_ORIGIN,
    supabaseUrl: result.data.SUPABASE_URL,
    publishableKey: result.data.SUPABASE_PUBLISHABLE_KEY,
  });
}

const rateLimitConfigSchema = z.object({
  REDIS_URL: z.url().refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "rediss:" ||
        (url.protocol === "redis:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) &&
      !url.search &&
      !url.hash &&
      ["", "/", "/0"].includes(url.pathname)
    );
  }),
  TRUSTED_CLIENT_IP_HEADER: z.enum(["none", "x-real-ip"]).default("none"),
});
export type RateLimitConfig = Readonly<{
  redisUrl: string;
  trustedClientIpHeader: "none" | "x-real-ip";
}>;
export function getRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  const result = rateLimitConfigSchema.safeParse({
    REDIS_URL: env.REDIS_URL,
    TRUSTED_CLIENT_IP_HEADER: env.TRUSTED_CLIENT_IP_HEADER,
  });
  if (!result.success)
    throw new Error("Invalid server configuration: request admission.");
  return Object.freeze({
    redisUrl: result.data.REDIS_URL,
    trustedClientIpHeader: result.data.TRUSTED_CLIENT_IP_HEADER,
  });
}
