import { z } from 'zod';

export const chatSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.strictObject({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20)
    .default([]),
});

export type ChatInput = z.infer<typeof chatSchema>;
