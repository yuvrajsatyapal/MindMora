import { z } from "zod";
import {
  noteTitleSchema,
  noteContentSchema,
  REVISION_MAX,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  listNotesSchema,
} from "./validation";
export const noteSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    title: noteTitleSchema,
    content: noteContentSchema,
    revision: z.number().int().positive().max(REVISION_MAX),
    createdAt: z.iso.datetime({ precision: 3 }),
    updatedAt: z.iso.datetime({ precision: 3 }),
    deletedAt: z.iso.datetime({ precision: 3 }).nullable(),
  })
  .strict();
export const profileSchema = z
  .object({
    userId: z.uuid(),
    displayName: z
      .string()
      .max(200)
      .refine((value) => !value.includes("\u0000"), "Invalid text.")
      .nullable(),
    createdAt: z.iso.datetime({ precision: 3 }),
    updatedAt: z.iso.datetime({ precision: 3 }),
  })
  .strict();
export type Note = z.infer<typeof noteSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;

export const noteSummarySchema = noteSchema.omit({ content: true });
export const notePageSchema = z
  .object({
    items: z.array(noteSummarySchema).max(100),
    nextCursor: z
      .object({ updatedAt: z.iso.datetime({ precision: 3 }), id: z.uuid() })
      .strict()
      .nullable(),
  })
  .strict();
export type NoteSummary = z.infer<typeof noteSummarySchema>;
export type NotePage = z.infer<typeof notePageSchema>;
