import { adminConnection, applyMigrations } from "./database-common.mjs";
let connection;
try {
  connection = adminConnection();
  await applyMigrations(connection);
  console.log("Database migrations applied.");
} catch (error) {
  console.error(
    `Database migration failed (${typeof error?.code === "string" ? error.code : "operation"}). Check configuration, TLS and migration privileges.`,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end({ timeout: 5 });
}
