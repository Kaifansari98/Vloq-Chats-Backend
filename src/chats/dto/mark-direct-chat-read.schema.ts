import { z } from 'zod';

export const markDirectChatReadSchema = z.object({
  participantUserId: z.number().int().positive(),
});

export type MarkDirectChatReadDto = z.infer<typeof markDirectChatReadSchema>;
