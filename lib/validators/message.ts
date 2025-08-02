import { z } from "zod";

export const messageSchema = z.object({
  message: z.string(),
  aliases: z.record(
    z.array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    ),
  ),
  history: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export type TMessageSchema = z.infer<typeof messageSchema>;
