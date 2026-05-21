import { z } from 'zod';

export const createDirectMessageSchema = z.object({
  participantUserId: z.number().int().positive(),
  content: z.string().trim().min(1).max(5000),
  replyToMessageUuid: z.string().uuid().optional(),
});

export type CreateDirectMessageDto = z.infer<typeof createDirectMessageSchema>;
