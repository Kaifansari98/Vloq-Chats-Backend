import { z } from 'zod';
import { formDataMentionsSchema } from './message-mention.schema';

export const uploadGroupMessageSchema = z.object({
  content: z.string().trim().max(5000).optional(),
  mentions: formDataMentionsSchema,
  replyToMessageUuid: z.string().uuid().optional(),
});

export type UploadGroupMessageDto = z.infer<typeof uploadGroupMessageSchema>;
