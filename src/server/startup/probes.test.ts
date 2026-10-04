// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { probeRedis, probePostgreSQL } from "./probes";
it("rejects missing service config without leaking credential input", async () => {
  await expect(
    probeRedis({ REDIS_URL: "https://private-password-marker" }),
  ).rejects.toThrow("Configuration is missing or invalid.");
  await expect(
    probePostgreSQL({ DATABASE_URL: "private-db-marker" }),
  ).rejects.toThrow("Configuration is missing or invalid.");
});
