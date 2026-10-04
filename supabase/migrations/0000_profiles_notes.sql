CREATE ROLE mindmora_request NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "notes_title_bound" CHECK (char_length("notes"."title") BETWEEN 1 AND 200 AND "notes"."title" = btrim("notes"."title")),
	CONSTRAINT "notes_content_bound" CHECK (octet_length("notes"."content") <= 1048576),
	CONSTRAINT "notes_revision_positive" CHECK ("notes"."revision" > 0),
	CONSTRAINT "notes_time_order" CHECK ("notes"."updated_at" >= "notes"."created_at" AND ("notes"."deleted_at" IS NULL OR "notes"."deleted_at" >= "notes"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_display_name_bound" CHECK ("profiles"."display_name" IS NULL OR char_length("profiles"."display_name") <= 200),
	CONSTRAINT "profiles_time_order" CHECK ("profiles"."updated_at" >= "profiles"."created_at")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_owner_active_cursor" ON "notes" USING btree ("user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "notes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE POLICY "notes_owner" ON "notes" AS PERMISSIVE FOR ALL TO "mindmora_request" USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "profiles_owner" ON "profiles" AS PERMISSIVE FOR ALL TO "mindmora_request" USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--> statement-breakpoint
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.notes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.profiles, public.notes FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public, auth TO mindmora_request;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth.uid() TO mindmora_request;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.profiles, public.notes TO mindmora_request;
--> statement-breakpoint
GRANT UPDATE (display_name, updated_at) ON public.profiles TO mindmora_request;
--> statement-breakpoint
GRANT UPDATE (title, content, revision, updated_at, deleted_at) ON public.notes TO mindmora_request;
