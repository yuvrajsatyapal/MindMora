import "server-only";
import { sql } from "drizzle-orm";
import {
  pgTable,
  primaryKey,
  customType,
  uuid,
  text,
  timestamp,
  integer,
  check,
  index,
  uniqueIndex,
  pgPolicy,
  pgRole,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
const requestRole = pgRole("mindmora_request").existing();
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
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
    createOperationId: uuid("create_operation_id"),
    createRequestHash: text("create_request_hash"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    titleKey: text("title_key"),
    knowledgeRevision: integer("knowledge_revision"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(sql`public.mindmora_search_vector(title, content)`),
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
    check("notes_knowledge_revision", sql`${t.knowledgeRevision} IS NULL OR ${t.knowledgeRevision} > 0 AND ${t.knowledgeRevision} <= ${t.revision}`),
    index("notes_owner_title_key").on(t.userId, sql`md5(${t.titleKey})`, t.id).where(sql`${t.deletedAt} IS NULL`),
    index("notes_search_vector").using("gin", t.searchVector).where(sql`${t.deletedAt} IS NULL`),
    check(
      "notes_create_identity",
      sql`(${t.createOperationId} IS NULL AND ${t.createRequestHash} IS NULL) OR (${t.createOperationId} IS NOT NULL AND ${t.createRequestHash} IS NOT NULL AND ${t.createRequestHash} ~ '^[0-9a-f]{64}$')`,
    ),
    uniqueIndex("notes_owner_create_operation")
      .on(t.userId, t.createOperationId)
      .where(sql`${t.createOperationId} IS NOT NULL`),
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

function sourcePolicy(sourceColumn: string, revisionColumn: string) {
  return {
    using: sql.raw(`auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = ${sourceColumn} AND n.user_id = auth.uid())`),
    withCheck: sql.raw(`auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = ${sourceColumn} AND n.user_id = auth.uid() AND n.deleted_at IS NULL AND n.revision = ${revisionColumn})`),
  };
}
export const noteLinks = pgTable('note_links', {
 userId:uuid('user_id').notNull(), sourceNoteId:uuid('source_note_id').notNull(), targetKey:text('target_key').notNull(), targetHash:text('target_hash').generatedAlwaysAs(sql`public.mindmora_key_hash(target_key)`), targetTitle:text('target_title').notNull(), sourceRevision:integer('source_revision').notNull(), occurrenceCount:integer('occurrence_count').notNull(), context:text('context').notNull(), updatedAt:timestamp('updated_at',{withTimezone:true,precision:3}).notNull().defaultNow(),
}, t=>[
 primaryKey({name:'note_links_user_id_source_note_id_target_hash_pk',columns:[t.userId,t.sourceNoteId,t.targetHash]}), index('note_links_owner_target').on(t.userId,t.targetHash,t.sourceNoteId),
 check('note_links_bounds',sql`char_length(${t.targetKey}) BETWEEN 1 AND 3600 AND char_length(${t.targetTitle}) BETWEEN 1 AND 200 AND char_length(${t.context}) <= 240 AND ${t.sourceRevision}>0 AND ${t.occurrenceCount}>0`),
 pgPolicy('note_links_owner',{for:'all',to:requestRole,...sourcePolicy('note_links.source_note_id','note_links.source_revision')}),
]).enableRLS();
export const noteTags = pgTable('note_tags', {
 userId:uuid('user_id').notNull(), noteId:uuid('note_id').notNull(), tagKey:text('tag_key').notNull(), tagHash:text('tag_hash').generatedAlwaysAs(sql`public.mindmora_key_hash(tag_key)`), displayName:text('display_name').notNull(), sourceRevision:integer('source_revision').notNull(), updatedAt:timestamp('updated_at',{withTimezone:true,precision:3}).notNull().defaultNow(),
},t=>[
 primaryKey({name:'note_tags_user_id_note_id_tag_hash_pk',columns:[t.userId,t.noteId,t.tagHash]}),index('note_tags_owner_key').on(t.userId,t.tagHash,t.noteId),
 check('note_tags_bounds',sql`char_length(${t.tagKey}) BETWEEN 1 AND 1152 AND char_length(${t.displayName}) BETWEEN 1 AND 64 AND ${t.sourceRevision}>0`),
 pgPolicy('note_tags_owner',{for:'all',to:requestRole,...sourcePolicy('note_tags.note_id','note_tags.source_revision')}),
]).enableRLS();
