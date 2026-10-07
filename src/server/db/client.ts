import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { getDatabaseConfig, type DatabaseConfig } from "./config";
import { assertVerifiedOwner, type VerifiedOwner } from "./user-context";
import * as schema from "./schema";
export class DatabaseFailure extends Error {
  constructor(
    readonly reason:
      | "query"
      | "request-role"
      | "runtime-role"
      | "pooled-identity"
      | "permission"
      | "timeout"
      | "connection" = "query",
  ) {
    super("Database operation unavailable.");
  }
}
export function createDatabase(config: DatabaseConfig) {
  const connection = postgres(config.url, {
    prepare: false,
    max: config.max,
    ssl: config.ssl ? { rejectUnauthorized: true, ca: config.ca } : false,
    connect_timeout: 10,
    idle_timeout: 20,
    onnotice: () => {},
  });
  const db = drizzle(connection, { schema });
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
  return {
    async run<T>(
      owner: VerifiedOwner,
      operation: (tx: Transaction) => Promise<T>,
    ): Promise<T> {
      assertVerifiedOwner(owner);
      try {
        return await db.transaction(async (tx) => {
          const roles =
            await tx.execute(sql`SELECT rolname, rolsuper, rolbypassrls, rolinherit, rolcreaterole, rolcreatedb, rolreplication,
       pg_has_role(session_user, 'mindmora_request', 'MEMBER') AS member,
       (has_table_privilege(session_user, 'public.notes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(session_user, 'public.notes', 'SELECT,INSERT,UPDATE,REFERENCES')) AS direct_notes,
       (has_table_privilege(session_user, 'public.profiles', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(session_user, 'public.profiles', 'SELECT,INSERT,UPDATE,REFERENCES')) AS direct_profiles,
       (has_table_privilege(session_user, 'public.note_links', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(session_user, 'public.note_links', 'SELECT,INSERT,UPDATE,REFERENCES')) AS direct_links,
       (has_table_privilege(session_user, 'public.note_tags', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(session_user, 'public.note_tags', 'SELECT,INSERT,UPDATE,REFERENCES')) AS direct_tags,
       current_user = session_user AS clean_role,
       nullif(current_setting('request.jwt.claim.sub', true),'') IS NULL AND nullif(current_setting('request.jwt.claims', true),'') IS NULL AS clean_claims
       FROM pg_roles WHERE rolname = session_user`);
          const requestRoles = await tx.execute(
            sql`SELECT rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles WHERE rolname = 'mindmora_request'`,
          );
          const scoped = requestRoles[0];
          if (
            !scoped ||
            scoped.rolsuper ||
            scoped.rolbypassrls ||
            scoped.rolcanlogin ||
            scoped.rolinherit ||
            scoped.rolcreaterole ||
            scoped.rolcreatedb ||
            scoped.rolreplication
          )
            throw new DatabaseFailure("request-role");
          const role = roles[0];
          if (
            !role ||
            role.rolname !== "mindmora_app" ||
            role.rolsuper ||
            role.rolbypassrls ||
            role.rolinherit ||
            role.rolcreaterole ||
            role.rolcreatedb ||
            role.rolreplication ||
            !role.member ||
            role.direct_notes ||
            role.direct_profiles ||
            role.direct_links ||
            role.direct_tags
          )
            throw new DatabaseFailure("runtime-role");
          if (!role.clean_role || !role.clean_claims)
            throw new DatabaseFailure("pooled-identity");
          await tx.execute(sql`SET LOCAL ROLE mindmora_request`);
          await tx.execute(
            sql`SELECT set_config('request.jwt.claim.sub', ${owner.userId}, true), set_config('request.jwt.claims', ${JSON.stringify({ sub: owner.userId, role: "mindmora_request" })}, true)`,
          );
          await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
          await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
          await tx.execute(
            sql`SET LOCAL idle_in_transaction_session_timeout = '10s'`,
          );
          await tx.execute(sql`SET LOCAL search_path = public, pg_catalog`);
          return operation(tx);
        });
      } catch (error) {
        if (error instanceof DatabaseFailure) throw error;
        const detail =
          error && typeof error === "object" && "cause" in error
            ? error.cause
            : error;
        const code =
          detail && typeof detail === "object" && "code" in detail
            ? detail.code
            : undefined;
        throw new DatabaseFailure(
          code === "42501"
            ? "permission"
            : ["57014", "55P03"].includes(String(code))
              ? "timeout"
              : ["CONNECTION_CLOSED", "CONNECT_TIMEOUT", "08006"].includes(
                    String(code),
                  )
                ? "connection"
                : "query",
        );
      }
    },
    close: () => connection.end({ timeout: 5 }),
  };
}

let shared: ReturnType<typeof createDatabase> | undefined;
/** Lazy process-local pool; public pages never open a database connection. */
export function getDatabase() {
  return (shared ??= createDatabase(getDatabaseConfig()));
}
