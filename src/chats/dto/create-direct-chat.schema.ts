import { z } from 'zod';

export const createDirectChatSchema = z.object({
  participantUserId: z.number().int().positive(),
});

export type CreateDirectChatDto = z.infer<typeof createDirectChatSchema>;
