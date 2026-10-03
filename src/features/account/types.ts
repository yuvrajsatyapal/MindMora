import { z } from "zod";

export const sessionProjectionSchema = z
  .object({
    user: z
      .object({
        id: z.uuid(),
        email: z.email().nullable(),
        displayName: z.string().max(200).nullable(),
      })
      .strict(),
  })
  .strict();
export type SessionProjection = z.infer<typeof sessionProjectionSchema>;
