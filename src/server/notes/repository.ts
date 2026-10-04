import "server-only";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDatabase } from "../db/client";
import { notes, profiles } from "../db/schema";
import type { VerifiedOwner } from "../db/user-context";
import type {
  CreateNoteInput,
  DeleteNoteInput,
  ListNotesInput,
  UpdateNoteInput,
} from "../../features/notes/types";
export type NoteRow = typeof notes.$inferSelect;
export type NoteOutcome =
  | { kind: "note"; row: NoteRow; created?: boolean }
  | { kind: "not_found" | "revision_conflict" | "idempotency_conflict" };
export type NoteDatabase = ReturnType<typeof getDatabase>;
/** Every query includes owner predicates in addition to effective RLS. */
export function createNoteRepository(database: NoteDatabase = getDatabase()) {
  const active = (owner: VerifiedOwner, id?: string) =>
    and(
      eq(notes.userId, owner.userId),
      isNull(notes.deletedAt),
      id ? eq(notes.id, id) : undefined,
    );
  type Transaction = Parameters<Parameters<NoteDatabase["run"]>[1]>[0];
  const time = sql`greatest(date_trunc('milliseconds', clock_timestamp()), ${notes.createdAt}, ${notes.updatedAt})`;
  async function run<T>(
    owner: VerifiedOwner,
    displayName: string | null,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return database.run(owner, async (tx) => {
      await tx
        .insert(profiles)
        .values({ userId: owner.userId, displayName })
        .onConflictDoNothing({ target: profiles.userId });
      return work(tx);
    });
  }
  return {
    async create(
      owner: VerifiedOwner,
      displayName: string | null,
      input: CreateNoteInput,
      operationId: string,
    ): Promise<NoteOutcome> {
      const hash = createHash("sha256")
        .update(JSON.stringify([input.title, input.content]))
        .digest("hex");
      return run(owner, displayName, async (tx) => {
        const [inserted] = await tx
          .insert(notes)
          .values({
            userId: owner.userId,
            ...input,
            createOperationId: operationId,
            createRequestHash: hash,
          })
          .onConflictDoNothing({
            target: [notes.userId, notes.createOperationId],
            where: sql`${notes.createOperationId} IS NOT NULL`,
          })
          .returning();
        if (inserted) return { kind: "note", row: inserted, created: true };
        const [existing] = await tx
          .select()
          .from(notes)
          .where(
            and(
              eq(notes.userId, owner.userId),
              eq(notes.createOperationId, operationId),
            ),
          )
          .limit(1);
        if (!existing || existing.deletedAt) return { kind: "not_found" };
        if (existing.createRequestHash !== hash)
          return { kind: "idempotency_conflict" };
        return { kind: "note", row: existing, created: false };
      });
    },
    async detail(
      owner: VerifiedOwner,
      displayName: string | null,
      id: string,
    ): Promise<NoteOutcome> {
      return run(owner, displayName, async (tx) => {
        const [row] = await tx
          .select()
          .from(notes)
          .where(active(owner, id))
          .limit(1);
        return row ? { kind: "note", row } : { kind: "not_found" };
      });
    },
    async list(
      owner: VerifiedOwner,
      displayName: string | null,
      input: ListNotesInput,
    ) {
      return database.run(owner, async (tx) => {
        await tx
          .insert(profiles)
          .values({ userId: owner.userId, displayName })
          .onConflictDoNothing({ target: profiles.userId });
        const cursor = input.cursor;
        return tx
          .select({
            id: notes.id,
            userId: notes.userId,
            title: notes.title,
            revision: notes.revision,
            createdAt: notes.createdAt,
            updatedAt: notes.updatedAt,
            deletedAt: notes.deletedAt,
          })
          .from(notes)
          .where(
            and(
              active(owner),
              cursor
                ? or(
                    lt(notes.updatedAt, new Date(cursor.updatedAt)),
                    and(
                      eq(notes.updatedAt, new Date(cursor.updatedAt)),
                      lt(notes.id, cursor.id),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(notes.updatedAt), desc(notes.id))
          .limit(input.limit + 1);
      });
    },
    async update(
      owner: VerifiedOwner,
      displayName: string | null,
      id: string,
      input: UpdateNoteInput,
    ): Promise<NoteOutcome> {
      return run(owner, displayName, async (tx) => {
        const [row] = await tx
          .update(notes)
          .set({
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.content !== undefined ? { content: input.content } : {}),
            revision: sql`${notes.revision}+1`,
            updatedAt: time,
          })
          .where(
            and(active(owner, id), eq(notes.revision, input.expectedRevision)),
          )
          .returning();
        if (row) return { kind: "note", row };
        const [existing] = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(active(owner, id))
          .limit(1);
        return { kind: existing ? "revision_conflict" : "not_found" };
      });
    },
    async remove(
      owner: VerifiedOwner,
      displayName: string | null,
      id: string,
      input: DeleteNoteInput,
    ): Promise<NoteOutcome> {
      return run(owner, displayName, async (tx) => {
        const [row] = await tx
          .update(notes)
          .set({
            deletedAt: time,
            updatedAt: time,
            revision: sql`${notes.revision}+1`,
          })
          .where(
            and(active(owner, id), eq(notes.revision, input.expectedRevision)),
          )
          .returning();
        if (row) return { kind: "note", row };
        const [existing] = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(active(owner, id))
          .limit(1);
        return { kind: existing ? "revision_conflict" : "not_found" };
      });
    },
  };
}
export type NoteRepository = ReturnType<typeof createNoteRepository>;
