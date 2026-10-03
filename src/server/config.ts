import "server-only";
import { z } from "zod";

const originSchema = z.url().pipe(z.string().refine((value) => {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return (
    (url.protocol === "https:" || (url.protocol === "http:" && loopback)) &&
    !url.username && !url.password &&
    url.pathname === "/" && !url.search && !url.hash
  );
})).transform((value) => new URL(value).origin);

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
