import "server-only";
import { styleText } from "node:util";
import { probeRedis, probePostgreSQL, safeProbeMessage } from "./probes";
export type StartupDependencies = {
  production: boolean;
  redis: () => Promise<void>;
  postgresql: () => Promise<void>;
  write: (line: string) => void;
};
const runtime = globalThis as typeof globalThis & {
  __mindmoraStartupHealth?: Promise<void>;
};
/** Global promise survives HMR/module duplication; failed production checks stay failed. */
export function registerStartupHealth(
  dependencies: StartupDependencies = {
    production: process.env.NODE_ENV === "production",
    redis: probeRedis,
    postgresql: probePostgreSQL,
    write: (line) => console.info(line),
  },
): Promise<void> {
  return (runtime.__mindmoraStartupHealth ??= run(dependencies));
}
async function run(dependencies: StartupDependencies) {
  const results = await Promise.allSettled([
    dependencies.redis(),
    dependencies.postgresql(),
  ]);
  const services = ["Redis", "PostgreSQL"] as const;
  for (const [index, result] of results.entries()) {
    const service = services[index];
    dependencies.write(
      result.status === "fulfilled"
        ? `${styleText("green", "✓")} ${service} connected`
        : `${styleText("red", "✗")} ${service} connection failed: ${safeProbeMessage(result.reason)}`,
    );
  }
  if (
    dependencies.production &&
    results.some((result) => result.status === "rejected")
  )
    throw new Error("Required startup dependencies unavailable.");
}
