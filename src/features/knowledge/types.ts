import { z } from "zod";
import { noteSummarySchema } from "../notes/types";
import { targetTitleSchema, tagKeySchema, tagDisplaySchema, targetCursorSchema, backlinkCursorSchema, tagCursorSchema, searchCursorSchema } from "./validation";
export type { CompleteInput, BacklinksInput, TagsInput, SearchInput } from "./validation";
export const targetSummarySchema = z.object({id:z.uuid(),userId:z.uuid(),title:noteSummarySchema.shape.title,revision:noteSummarySchema.shape.revision}).strict();
export const targetPageSchema = z.object({items:z.array(targetSummarySchema).max(50),nextCursor:targetCursorSchema.nullable()}).strict();
const resolutionSchema = z.discriminatedUnion("status",[
  z.object({target:targetTitleSchema,key:z.string(),status:z.literal("resolved"),note:targetSummarySchema}).strict(),
  z.object({target:targetTitleSchema,key:z.string(),status:z.enum(["missing","ambiguous"]),note:z.null()}).strict(),
]);
export const resolutionPageSchema = z.object({items:z.array(resolutionSchema).max(50)}).strict();
export const backlinksPageSchema = z.object({targetRevision:z.number().int().positive(),resolution:z.enum(["resolved","ambiguous"]),total:z.number().int().nonnegative(),items:z.array(z.object({sourceId:z.uuid(),title:noteSummarySchema.shape.title,sourceRevision:z.number().int().positive(),occurrenceCount:z.number().int().positive(),context:z.string().refine(s=>[...s].length<=240)}).strict()).max(100),nextCursor:backlinkCursorSchema.nullable()}).strict();
export const tagPageSchema = z.object({items:z.array(z.object({key:tagKeySchema,displayName:tagDisplaySchema,noteCount:z.number().int().nonnegative()}).strict()).max(100),nextCursor:tagCursorSchema.nullable()}).strict();
export const searchPageSchema = z.object({items:z.array(noteSummarySchema.extend({snippet:z.string().refine(s=>[...s].length<=240)})).max(100),nextCursor:searchCursorSchema.nullable()}).strict();
export type TargetSummary = z.infer<typeof targetSummarySchema>;
export type TargetPage = z.infer<typeof targetPageSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
export type ResolutionPage = z.infer<typeof resolutionPageSchema>;
export type BacklinksPage = z.infer<typeof backlinksPageSchema>;
export type TagPage = z.infer<typeof tagPageSchema>;
export type SearchPage = z.infer<typeof searchPageSchema>;
