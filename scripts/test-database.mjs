import { spawnSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { provisionRuntimeRole } from "./provision-role.ts";
import { applyMigrations } from "./database-common.mjs";
const name = `mindmora-rls-${randomBytes(6).toString("hex")}`;
const password = randomBytes(32).toString("base64url");
function docker(args, env = process.env) {
  const result = spawnSync("docker", args, { env, encoding: "utf8" });
  if (result.status !== 0) throw new Error("Docker operation failed.");
  return result.stdout.trim();
}
let connection,
  started = false;
let stage = "container";
try {
  docker(
    [
      "run",
      "--detach",
      "--name",
      name,
      "--tmpfs",
      "/var/lib/postgresql/data",
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_PASSWORD",
      "postgres:17@sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f",
    ],
    { ...process.env, POSTGRES_PASSWORD: password },
  );
  started = true;
  stage = "port";
  const port = docker(["port", name, "5432/tcp"]).split(":").at(-1);
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
  stage = "connect";
  connection = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 2,
    onnotice: () => {},
  });
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      await connection`SELECT 1`;
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Database startup failed.");
  stage = "bootstrap";
  await connection.unsafe(
    `CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true),''), nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub')::uuid $$;`,
  );
  stage = "provision-rollback";
  let rejected = false;
  try {
    await provisionRuntimeRole(connection, password);
  } catch {
    rejected = true;
  }
  if (
    !rejected ||
    (await connection`SELECT 1 FROM pg_roles WHERE rolname = 'mindmora_app'`)
      .length
  )
    throw new Error("Failed role provisioning must roll back.");
  console.log("PASS: failed membership grant rolls back generated login.");
  stage = "migration";
  await applyMigrations(connection);
  await applyMigrations(connection);
  console.log("PASS: versioned migration applies fresh and safely re-runs.");
  stage = "runtime-role";
  await provisionRuntimeRole(connection, password);
  const runtime = new URL(url);
  runtime.username = "mindmora_app";
  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "vitest.database.config.ts",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: url,
          DATABASE_URL: runtime.toString(),
          DATABASE_POOL_MAX: "1",
        },
      },
    );
    child.on("exit", resolve);
    child.on("error", () => resolve(1));
  });
  process.exitCode = result ?? 1;
} catch (error) {
  console.error(
    `Disposable database verification failed at ${stage} (${typeof error?.code === "string" ? error.code : "operation"}). No credentials printed.`,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end({ timeout: 5 });
  if (started) docker(["rm", "--force", name]);
}
