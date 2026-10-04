import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getMigrationConfig } from "../src/server/db/config.ts";
export function adminConnection() {
  const config = getMigrationConfig();
  return postgres(config.url, {
    prepare: false,
    max: 1,
    ssl: config.ssl ? { rejectUnauthorized: true, ca: config.ca } : false,
    connect_timeout: 10,
    onnotice: () => {},
  });
}
export async function applyMigrations(connection) {
  await migrate(drizzle(connection), {
    migrationsFolder: "./supabase/migrations",
  });
}
