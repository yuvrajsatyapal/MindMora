import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
const image =
  "postgres:17@sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f";
function docker(args, env = process.env) {
  const result = spawnSync("docker", args, { encoding: "utf8", env });
  if (result.status !== 0)
    throw new Error("Local startup PostgreSQL fixture unavailable.");
  return result.stdout.trim();
}
export async function withTestPostgres(run, { schema = false } = {}) {
  const name = `mindmora-startup-pg-${randomBytes(6).toString("hex")}`;
  const password = randomBytes(24).toString("hex");
  let started = false;
  let connection;
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
        image,
      ],
      { ...process.env, POSTGRES_PASSWORD: password },
    );
    started = true;
    const port = docker(["port", name, "5432/tcp"]).split(":").at(-1);
    connection = postgres(
      `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,
      {
        max: 1,
        connect_timeout: 1,
        onnotice: () => {},
      },
    );
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        await connection`SELECT 1`;
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!ready)
      throw new Error("Local startup PostgreSQL fixture unavailable.");
    // Password is locally generated hex; no untrusted SQL or production schema is involved.
    await connection.unsafe(
      `CREATE ROLE mindmora_app LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${password}'`,
    );
    if (schema) {
      await connection.unsafe(
        `CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`,
      );
      await migrate(drizzle(connection), {
        migrationsFolder: "supabase/migrations",
      });
      await connection.unsafe("GRANT mindmora_request TO mindmora_app");
      await connection`INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222')`;
    }
    return await run(
      `postgresql://mindmora_app:${password}@127.0.0.1:${port}/postgres`,
    );
  } catch {
    throw new Error("Local startup PostgreSQL fixture unavailable.");
  } finally {
    if (connection) await connection.end({ timeout: 0 });
    if (started) docker(["rm", "--force", name]);
  }
}
