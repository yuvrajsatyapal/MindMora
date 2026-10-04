import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stageCredentialFile } from "./provision-files.ts";
import { provisionRuntimeRole } from "./provision-role.ts";
import { adminConnection } from "./database-common.mjs";
let connection;
try {
  const env = await readFile(".env", "utf8");
  if (!/^DATABASE_URL=[ \t]*$/m.test(env))
    throw new Error("Runtime URL is not empty; do not overwrite.");
  connection = adminConnection();
  const existing =
    await connection`SELECT 1 FROM pg_roles WHERE rolname = 'mindmora_app'`;
  if (existing.length)
    throw new Error("Role already exists; do not rotate implicitly.");
  const password = randomBytes(32).toString("base64url");
  const url = new URL(process.env.MIGRATION_DATABASE_URL);
  const migrationUser = decodeURIComponent(url.username);
  url.username = migrationUser.includes(".")
    ? `mindmora_app.${migrationUser.split(".").slice(1).join(".")}`
    : "mindmora_app";
  url.password = password;

  const stage = await stageCredentialFile(
    ".env",
    env,
    env.replace(/^DATABASE_URL=[ \t]*$/m, `DATABASE_URL=${url.toString()}`),
  );
  await provisionRuntimeRole(connection, password);
  await stage.publish();
  console.log(
    "Constrained database login provisioned; DATABASE_URL written to ignored .env.",
  );
} catch {
  console.error(
    "Database role provisioning failed. Check configuration/privileges or an existing role; credentials were not printed. If .env.database-pending exists, retain it for recovery; do not rerun or delete it blindly.",
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end({ timeout: 5 });
}
