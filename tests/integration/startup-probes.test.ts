import { expect, it, vi } from "vitest";
import { createServer, type Socket } from "node:net";
vi.mock("server-only", () => ({}));
import { probeRedis, probePostgreSQL } from "../../src/server/startup/probes";
const redisUrl = process.env.STARTUP_TEST_REDIS_URL;
const databaseUrl = process.env.STARTUP_TEST_DATABASE_URL;
if (!redisUrl || !databaseUrl) throw new Error("Use npm run test:startup.");
it("PING and SELECT 1 succeed with real local services", async () => {
  await Promise.all([
    probeRedis({ REDIS_URL: redisUrl }),
    probePostgreSQL({ DATABASE_URL: databaseUrl }),
  ]);
});
it("authentication failures expose only fixed safe messages", async () => {
  const redis = new URL(redisUrl);
  redis.username = "private-nonexistent-user";
  redis.password = "private-token-marker";
  const database = new URL(databaseUrl);
  database.password = "private-password-marker";
  await Promise.all([
    expect(probeRedis({ REDIS_URL: redis.toString() })).rejects.toThrow(
      "Connection could not be established.",
    ),
    expect(
      probePostgreSQL({ DATABASE_URL: database.toString() }),
    ).rejects.toThrow("Connection could not be established."),
  ]);
});
it.each(["Redis", "PostgreSQL"] as const)(
  "bounds stalled %s handshakes and closes sockets",
  async (service) => {
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Invalid fixture address.");
    const started = performance.now();
    try {
      const work =
        service === "Redis"
          ? probeRedis({ REDIS_URL: `redis://127.0.0.1:${address.port}` })
          : probePostgreSQL({
              DATABASE_URL: `postgresql://mindmora_app:private-password-marker@127.0.0.1:${address.port}/postgres`,
            });
      await expect(work).rejects.toThrow(
        /Connection (?:check timed out|could not be established)\./,
      );
      expect(performance.now() - started).toBeLessThan(6500);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
