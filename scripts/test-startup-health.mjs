import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { withTestRedis } from "./local-test-redis.mjs";
import { withTestPostgres } from "./local-test-postgres.mjs";
const next = "node_modules/next/dist/bin/next";
let stage = "local fixtures";
function check(condition, message) {
  if (!condition) throw new Error(message);
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function launch(mode, env) {
  const port = await freePort();
  const child = spawn(
    process.execPath,
    [
      next,
      mode,
      ...(mode === "dev" ? ["--webpack"] : []),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PHASE: "",
        NODE_ENV: mode === "dev" ? "development" : "production",
        DATABASE_CA_CERT_PATH: "",
        TRUSTED_CLIENT_IP_HEADER: "none",
        ...env,
      },
    },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  let exited = false;
  let code;
  const exit = once(child, "exit").then(([value]) => {
    exited = true;
    code = value;
  });
  return {
    child,
    port,
    output: () => output,
    exited: () => exited,
    code: () => code,
    async stop() {
      if (!exited) {
        child.kill("SIGTERM");
        const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
        try {
          await exit;
        } finally {
          clearTimeout(timer);
        }
      }
    },
  };
}
async function until(predicate, timeout = 20000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > end) throw new Error("Startup check deadline exceeded.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
function successCount(output, service) {
  return output.split(`✓ ${service} connected`).length - 1;
}
async function healthy(redisUrl, databaseUrl, mode = "start") {
  const server = await launch(mode, {
    REDIS_URL: redisUrl,
    DATABASE_URL: databaseUrl,
  });
  try {
    await until(
      () =>
        server.exited() ||
        (server.output().includes("✓ Redis connected") &&
          server.output().includes("✓ PostgreSQL connected")),
      mode === "dev" ? 60000 : 20000,
    );
    check(!server.exited(), "Healthy server exited.");
    const first = await fetch(`http://127.0.0.1:${server.port}/`);
    check(first.status === 200, "Healthy server did not serve public page.");
    const second = await fetch(
      `http://127.0.0.1:${server.port}/dev/design-system/`,
    );
    check(second.status === 200, "Healthy server did not serve showcase.");
    for (const service of ["Redis", "PostgreSQL"])
      check(
        successCount(server.output(), service) === 1,
        "Duplicate/missing startup success log.",
      );
    check(
      !server.output().includes(redisUrl) &&
        !server.output().includes(databaseUrl),
      "Connection URL leaked.",
    );
  } finally {
    await server.stop();
  }
}
async function failed(redisUrl, databaseUrl, service) {
  const server = await launch("start", {
    REDIS_URL: redisUrl,
    DATABASE_URL: databaseUrl,
  });
  try {
    try {
      await until(server.exited);
    } catch {
      console.log(
        "Safe failed-start diagnostics:",
        JSON.stringify({
          exited: server.exited(),
          redisFailureLogged: server
            .output()
            .includes("✗ Redis connection failed:"),
          postgresFailureLogged: server
            .output()
            .includes("✗ PostgreSQL connection failed:"),
          fixedFailureLogged: server
            .output()
            .includes("Required startup dependencies unavailable."),
        }),
      );
      throw new Error("Startup check deadline exceeded.");
    }
    check(server.code() !== 0, "Production failure did not exit nonzero.");
    check(
      server.output().includes(`✗ ${service} connection failed:`),
      "Failure log missing.",
    );
    const other = service === "Redis" ? "PostgreSQL" : "Redis";
    check(
      successCount(server.output(), service) === 0 &&
        successCount(server.output(), other) === 1,
      "Production failed-service results were inconsistent.",
    );
    let served = false;
    try {
      served = (await fetch(`http://127.0.0.1:${server.port}/`)).status === 200;
    } catch {
      /* exited server */
    }
    check(!served, "Failed production served a public page.");
    check(
      !server.output().includes(redisUrl) &&
        !server.output().includes(databaseUrl),
      "Connection URL leaked.",
    );
  } finally {
    await server.stop();
  }
}
try {
  await withTestRedis((redisUrl) =>
    withTestPostgres(async (databaseUrl) => {
      stage = "real protocol probes and deadlines";
      const probes = spawn(
        process.execPath,
        [
          "node_modules/vitest/vitest.mjs",
          "run",
          "--config",
          "vitest.startup.config.ts",
        ],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            STARTUP_TEST_REDIS_URL: redisUrl,
            STARTUP_TEST_DATABASE_URL: databaseUrl,
          },
        },
      );
      const [probeCode] = await once(probes, "exit");
      check(probeCode === 0, "Real protocol probe tests failed.");
      stage = "healthy production startup/restart";
      await healthy(redisUrl, databaseUrl);
      await healthy(redisUrl, databaseUrl);
      console.log(
        "PASS: two production starts each log PING/SELECT 1 success exactly once across requests.",
      );
      stage = "production Redis fail-fast";
      const unavailablePort = await freePort();
      await failed(
        `redis://127.0.0.1:${unavailablePort}`,
        databaseUrl,
        "Redis",
      );
      console.log(
        "PASS: unavailable Redis prevents production readiness and exits nonzero.",
      );
      stage = "production PostgreSQL fail-fast";
      await failed(
        redisUrl,
        `postgresql://mindmora_app:private-password-marker@127.0.0.1:${unavailablePort}/postgres`,
        "PostgreSQL",
      );
      console.log(
        "PASS: unavailable PostgreSQL prevents production readiness without exposing credentials.",
      );
      stage = "development warnings";
      const dev = await launch("dev", { REDIS_URL: "", DATABASE_URL: "" });
      let devStatus;
      try {
        await until(
          () =>
            dev.exited() ||
            dev.output().includes("✗ PostgreSQL connection failed:"),
          60000,
        );
        check(!dev.exited(), "Development exited on missing configuration.");
        for (let attempt = 0; attempt < 30; attempt++) {
          const page = await fetch(`http://127.0.0.1:${dev.port}/`);
          devStatus = page.status;
          await page.text();
          if (devStatus === 200) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        check(devStatus === 200, "Development public page unavailable.");
        for (const service of ["Redis", "PostgreSQL"])
          check(
            dev.output().split(`✗ ${service} connection failed:`).length === 2,
            "Development warning missing/duplicated.",
          );
        console.log(
          "PASS: development warns once for missing services and serves the public page.",
        );
      } catch {
        throw new Error("Development health behavior failed.");
      } finally {
        await dev.stop();
      }
    }),
  );
} catch (error) {
  const safe = [
    "Startup check deadline exceeded.",
    "Production failure did not exit nonzero.",
    "Failure log missing.",
    "Failed production served a public page.",
    "Connection URL leaked.",
  ].includes(error?.message)
    ? error.message
    : "Check failed.";
  console.error(
    `Startup integration failed at ${stage}: ${safe} Credentials and process output omitted.`,
  );
  process.exitCode = 1;
}
