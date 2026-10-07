CREATE FUNCTION public.mindmora_search_vector(note_title text, note_content text) RETURNS tsvector LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
BEGIN
  RETURN setweight(to_tsvector('simple', note_title), 'A') || setweight(to_tsvector('simple', note_content), 'B');
EXCEPTION WHEN program_limit_exceeded THEN RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.mindmora_query_vector(note_title text, note_content text, search_query text) RETURNS tsvector LANGUAGE sql STABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
WITH positions AS (
 SELECT lexemes[1] AS lexeme, row_number() OVER (ORDER BY ordinality) AS position
 FROM ts_debug('simple', note_content) WITH ORDINALITY
 WHERE cardinality(lexemes) > 0
), relevant AS (
 SELECT lexeme, least(position, 16383) AS position,
 row_number() OVER (PARTITION BY lexeme ORDER BY position) AS occurrence
 FROM positions WHERE lexeme = ANY(tsvector_to_array(to_tsvector('simple', search_query)))
), terms AS (
 SELECT lexeme, string_agg(DISTINCT position::text, ',') AS positions
 FROM relevant WHERE occurrence <= 256 GROUP BY lexeme
)
SELECT setweight(to_tsvector('simple', note_title), 'A') || setweight(coalesce((SELECT string_agg(quote_literal(lexeme) || ':' || positions, ' ')::tsvector FROM terms), ''::tsvector), 'B')
$$;
--> statement-breakpoint
CREATE FUNCTION public.mindmora_key_hash(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$ SELECT encode(sha256(convert_to(value, 'UTF8')), 'hex') $$;
--> statement-breakpoint
CREATE TABLE "note_links" (
	"user_id" uuid NOT NULL,
	"source_note_id" uuid NOT NULL,
	"target_key" text NOT NULL,
	"target_hash" text GENERATED ALWAYS AS (public.mindmora_key_hash(target_key)) STORED,
	"target_title" text NOT NULL,
	"source_revision" integer NOT NULL,
	"occurrence_count" integer NOT NULL,
	"context" text NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_links_user_id_source_note_id_target_hash_pk" PRIMARY KEY("user_id","source_note_id","target_hash"),
	CONSTRAINT "note_links_bounds" CHECK (char_length("note_links"."target_key") BETWEEN 1 AND 3600 AND char_length("note_links"."target_title") BETWEEN 1 AND 200 AND char_length("note_links"."context") <= 240 AND "note_links"."source_revision">0 AND "note_links"."occurrence_count">0)
);
--> statement-breakpoint
ALTER TABLE "note_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "note_tags" (
	"user_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"tag_key" text NOT NULL,
	"tag_hash" text GENERATED ALWAYS AS (public.mindmora_key_hash(tag_key)) STORED,
	"display_name" text NOT NULL,
	"source_revision" integer NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_tags_user_id_note_id_tag_hash_pk" PRIMARY KEY("user_id","note_id","tag_hash"),
	CONSTRAINT "note_tags_bounds" CHECK (char_length("note_tags"."tag_key") BETWEEN 1 AND 1152 AND char_length("note_tags"."display_name") BETWEEN 1 AND 64 AND "note_tags"."source_revision">0)
);
--> statement-breakpoint
ALTER TABLE "note_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "title_key" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "knowledge_revision" integer;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (public.mindmora_search_vector(title, content)) STORED;--> statement-breakpoint
CREATE INDEX "note_links_owner_target" ON "note_links" USING btree ("user_id","target_hash","source_note_id");--> statement-breakpoint
CREATE INDEX "note_tags_owner_key" ON "note_tags" USING btree ("user_id","tag_hash","note_id");--> statement-breakpoint
CREATE INDEX "notes_owner_title_key" ON "notes" USING btree ("user_id",md5("title_key"),"id") WHERE "notes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notes_search_vector" ON "notes" USING gin ("search_vector") WHERE "notes"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_knowledge_revision" CHECK ("notes"."knowledge_revision" IS NULL OR "notes"."knowledge_revision" > 0 AND "notes"."knowledge_revision" <= "notes"."revision");--> statement-breakpoint
CREATE POLICY "note_links_owner" ON "note_links" AS PERMISSIVE FOR ALL TO "mindmora_request" USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_links.source_note_id AND n.user_id = auth.uid())) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_links.source_note_id AND n.user_id = auth.uid() AND n.deleted_at IS NULL AND n.revision = note_links.source_revision));--> statement-breakpoint
CREATE POLICY "note_tags_owner" ON "note_tags" AS PERMISSIVE FOR ALL TO "mindmora_request" USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_tags.note_id AND n.user_id = auth.uid())) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_tags.note_id AND n.user_id = auth.uid() AND n.deleted_at IS NULL AND n.revision = note_tags.source_revision));
--> statement-breakpoint
ALTER TABLE public.note_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.note_links, public.note_tags FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_links, public.note_tags TO mindmora_request;
--> statement-breakpoint
GRANT UPDATE (title_key, knowledge_revision) ON public.notes TO mindmora_request;
