// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { registerStartupHealth, type StartupDependencies } from "./health";
const runtime = globalThis as typeof globalThis & {
  __mindmoraStartupHealth?: Promise<void>;
};
beforeEach(() => {
  vi.stubEnv("FORCE_COLOR", "0");
  vi.stubEnv("NO_COLOR", undefined);
  vi.stubEnv("NODE_DISABLE_COLORS", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete runtime.__mindmoraStartupHealth;
});
function fixture(overrides: Partial<StartupDependencies> = {}) {
  const lines: string[] = [];
  let redisChecks = 0;
  let postgresChecks = 0;
  const deps: StartupDependencies = {
    production: false,
    redis: async () => {
      redisChecks++;
    },
    postgresql: async () => {
      postgresChecks++;
    },
    write: (line) => lines.push(line),
    ...overrides,
  };
  return { deps, lines, counts: () => ({ redisChecks, postgresChecks }) };
}
describe("once-per-process startup health", () => {
  it("prints both successful service results before resolving startup", async () => {
    const f = fixture();
    await registerStartupHealth(f.deps);
    expect(f.lines).toEqual(["✓ Redis connected", "✓ PostgreSQL connected"]);
  });
  it("shares one check across simultaneous calls and subsequent registrations", async () => {
    const f = fixture();
    await Promise.all([
      registerStartupHealth(f.deps),
      registerStartupHealth(f.deps),
    ]);
    await registerStartupHealth(f.deps);
    expect(f.counts()).toEqual({ redisChecks: 1, postgresChecks: 1 });
    expect(f.lines).toHaveLength(2);
  });
  it("continues development with fixed errors and excludes nested credential markers", async () => {
    const f = fixture({
      redis: async () => {
        throw new Error("rediss://private-token-marker@private-url-marker");
      },
      postgresql: async () => {
        throw {
          message: "private-db-marker",
          password: "private-password-marker",
        };
      },
    });
    await expect(registerStartupHealth(f.deps)).resolves.toBeUndefined();
    expect(f.lines.join("\n")).not.toContain("private-");
    expect(f.lines).toEqual([
      "✗ Redis connection failed: Connection could not be established.",
      "✗ PostgreSQL connection failed: Connection could not be established.",
    ]);
  });
  it.each(["redis", "postgresql"] as const)(
    "fails production startup safely when %s fails",
    async (service) => {
      const f = fixture({
        production: true,
        [service]: async () => {
          throw new Error("private-credential-marker");
        },
      });
      await expect(registerStartupHealth(f.deps)).rejects.toThrow(
        "Required startup dependencies unavailable.",
      );
      expect(f.lines).toHaveLength(2);
      expect(f.lines.join("\n")).not.toContain("private-");
      await expect(registerStartupHealth(f.deps)).rejects.toThrow(
        "Required startup dependencies unavailable.",
      );
      expect(f.lines).toHaveLength(2);
    },
  );
});

it("retains the global once guard when the startup module is reloaded", async () => {
  const f = fixture();
  await registerStartupHealth(f.deps);
  vi.resetModules();
  const reloaded = await import("./health");
  await reloaded.registerStartupHealth(f.deps);
  expect(f.counts()).toEqual({ redisChecks: 1, postgresChecks: 1 });
  expect(f.lines).toHaveLength(2);
});

it("colors only the success ticks green when terminal color is enabled", async () => {
  vi.stubEnv("FORCE_COLOR", "1");
  const f = fixture();
  await registerStartupHealth(f.deps);
  expect(f.lines).toEqual([
    "\u001b[32m✓\u001b[39m Redis connected",
    "\u001b[32m✓\u001b[39m PostgreSQL connected",
  ]);
});

it("keeps startup output plain when NO_COLOR disables terminal styling", async () => {
  vi.stubEnv("FORCE_COLOR", undefined);
  vi.stubEnv("NO_COLOR", "1");
  const f = fixture();
  await registerStartupHealth(f.deps);
  expect(f.lines).toEqual(["✓ Redis connected", "✓ PostgreSQL connected"]);
});
