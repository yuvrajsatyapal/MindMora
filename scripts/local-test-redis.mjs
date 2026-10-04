import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "redis";
// Disposable Redis-compatible BSD server; no cloud resources or persistent volumes.
const image =
  "valkey/valkey:8.1.10-alpine@sha256:081c2f5cb575efc901aa80ff9cdbd1ec6a301682fd35e1ebb4b0990a4a4a8507";
function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error("Local Redis test container operation failed.");
  return result.stdout.trim();
}
export async function withTestRedis(run) {
  const name = `mindmora-limits-${randomBytes(6).toString("hex")}`;
  let started = false;
  let client;
  try {
    docker([
      "run",
      "--detach",
      "--name",
      name,
      "--publish",
      "127.0.0.1::6379",
      image,
      "valkey-server",
      "--save",
      "",
      "--appendonly",
      "no",
      "--maxmemory",
      "32mb",
      "--maxmemory-policy",
      "noeviction",
    ]);
    started = true;
    const port = docker(["port", name, "6379/tcp"]).split(":").at(-1);
    const url = `redis://127.0.0.1:${port}`;
    for (let i = 0; i < 30; i++) {
      client = createClient({
        url,
        socket: { connectTimeout: 500, reconnectStrategy: false },
      });
      client.on("error", () => {});
      try {
        await client.connect();
        await client.ping();
        break;
      } catch {
        if (client.isOpen) client.destroy();
        client = undefined;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!client) throw new Error("Local Redis test container not ready.");
    client.destroy();
    client = undefined;
    return await run(url);
  } finally {
    if (client?.isOpen) client.destroy();
    if (started) docker(["rm", "--force", name]);
  }
}
