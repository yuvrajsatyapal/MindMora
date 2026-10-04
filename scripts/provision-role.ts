import type { Sql } from "postgres";
/** Role and membership either both commit or both roll back. */
export async function provisionRuntimeRole(connection: Sql, password: string) {
  await connection.begin(async (tx) => {
    const existing =
      await tx`SELECT 1 FROM pg_roles WHERE rolname = 'mindmora_app'`;
    if (existing.length) throw new Error("Database login already exists.");
    const [statement] =
      await tx`SELECT format('CREATE ROLE mindmora_app LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',${password}::text) AS ddl`;
    if (typeof statement.ddl !== "string")
      throw new Error("Database role statement unavailable.");
    await tx.unsafe(statement.ddl);
    await tx`GRANT mindmora_request TO mindmora_app`;
  });
}
