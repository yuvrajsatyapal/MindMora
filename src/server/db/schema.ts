import "server-only";
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  check,
  index,
  pgPolicy,
  pgRole,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
const requestRole = pgRole("mindmora_request").existing();
const owner = sql`auth.uid() = user_id`;
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "profiles_display_name_bound",
      sql`${t.displayName} IS NULL OR char_length(${t.displayName}) <= 200`,
    ),
    check("profiles_time_order", sql`${t.updatedAt} >= ${t.createdAt}`),
    pgPolicy("profiles_owner", {
      for: "all",
      to: requestRole,
      using: owner,
      withCheck: owner,
    }),
  ],
).enableRLS();
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    check(
      "notes_title_bound",
      sql`char_length(${t.title}) BETWEEN 1 AND 200 AND ${t.title} = btrim(${t.title})`,
    ),
    check("notes_content_bound", sql`octet_length(${t.content}) <= 1048576`),
    check("notes_revision_positive", sql`${t.revision} > 0`),
    check(
      "notes_time_order",
      sql`${t.updatedAt} >= ${t.createdAt} AND (${t.deletedAt} IS NULL OR ${t.deletedAt} >= ${t.createdAt})`,
    ),
    index("notes_owner_active_cursor")
      .on(t.userId, t.updatedAt.desc(), t.id.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    pgPolicy("notes_owner", {
      for: "all",
      to: requestRole,
      using: owner,
      withCheck: owner,
    }),
  ],
).enableRLS();
