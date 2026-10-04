import { z } from "zod";
export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_MAX_BYTES = 1_048_576;
export const REVISION_MAX = 2_147_483_647;
export const noteTitleSchema = z
  .string()
  .refine((value) => !value.includes("\u0000"), "Invalid text.")
  .trim()
  .min(1)
  .refine((value) => [...value].length <= NOTE_TITLE_MAX, "Title is too long.");
export const noteContentSchema = z
  .string()
  .refine((value) => !value.includes("\u0000"), "Invalid text.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= NOTE_CONTENT_MAX_BYTES,
    "Content is too large.",
  );
export const createNoteSchema = z
  .object({ title: noteTitleSchema, content: noteContentSchema })
  .strict();
export const updateNoteSchema = z
  .object({
    title: noteTitleSchema.optional(),
    content: noteContentSchema.optional(),
    expectedRevision: z
      .number()
      .int()
      .positive()
      .max(REVISION_MAX - 1),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.content !== undefined,
    "At least one changed field is required.",
  );
export const deleteNoteSchema = z
  .object({
    expectedRevision: z
      .number()
      .int()
      .positive()
      .max(REVISION_MAX - 1),
  })
  .strict();
export const noteCursorSchema = z
  .object({ updatedAt: z.iso.datetime({ precision: 3 }), id: z.uuid() })
  .strict();
export const listNotesSchema = z
  .object({
    limit: z
      .union([
        z.number(),
        z
          .string()
          .regex(/^[0-9]{1,3}$/)
          .transform(Number),
      ])
      .pipe(z.number().int().min(1).max(100))
      .default(20),
    cursor: noteCursorSchema.optional(),
  })
  .strict();
