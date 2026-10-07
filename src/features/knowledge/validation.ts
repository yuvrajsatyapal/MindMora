import { z } from "zod";
import { noteTitleSchema } from "../notes/validation";
import { validWikiTarget } from "./syntax";
const boundedText = (max: number) => z.string().refine(value => !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && [...value].length <= max, "Invalid text.");
export const targetTitleSchema = boundedText(200).trim().min(1).refine(validWikiTarget,"Invalid wiki target.");
export const tagKeySchema = boundedText(1152).min(1);
export const tagDisplaySchema = boundedText(64).min(1);
const limitSchema = (max = 100) => z.union([z.number(), z.string().regex(/^[0-9]{1,3}$/).transform(Number)]).pipe(z.number().int().min(1).max(max)).default(20);
export const targetCursorSchema = z.object({title:noteTitleSchema,id:z.uuid()}).strict();
export const backlinkCursorSchema = z.object({sourceId:z.uuid()}).strict();
export const tagCursorSchema = z.object({key:tagKeySchema}).strict();
export const searchCursorSchema = z.union([
  z.object({queryKey:z.string().regex(/^[a-f0-9]{64}$/),rank:z.number().finite().nonnegative(),id:z.uuid()}).strict(),
  z.object({queryKey:z.string().regex(/^[a-f0-9]{64}$/),updatedAt:z.iso.datetime({precision:3}),id:z.uuid()}).strict(),
]);
export const targetCompleteSchema = z.object({kind:z.literal("complete"),prefix:boundedText(200),limit:limitSchema(50),cursor:targetCursorSchema.optional()}).strict();
export const targetResolveSchema = z.object({kind:z.literal("resolve"),targets:z.array(targetTitleSchema).min(1).max(50)}).strict();
export const wikiTargetsSchema = z.discriminatedUnion("kind",[targetCompleteSchema,targetResolveSchema]);
export const backlinksInputSchema = z.object({limit:limitSchema(),cursor:backlinkCursorSchema.optional()}).strict();
export const tagsInputSchema = z.object({limit:limitSchema(),cursor:tagCursorSchema.optional()}).strict();
export const searchInputSchema = z.object({query:boundedText(256).default(""),tag:tagKeySchema.optional(),limit:limitSchema(),cursor:searchCursorSchema.optional()}).strict();
export type CompleteInput = z.infer<typeof targetCompleteSchema>;
export type BacklinksInput = z.infer<typeof backlinksInputSchema>;
export type TagsInput = z.infer<typeof tagsInputSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
