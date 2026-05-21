import { z } from 'zod';
import { messageMentionSchema } from './message-mention.schema';

export const createGroupMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  mentions: z.array(messageMentionSchema).optional(),
  replyToMessageUuid: z.string().uuid().optional(),
});

export type CreateGroupMessageDto = z.infer<typeof createGroupMessageSchema>;
