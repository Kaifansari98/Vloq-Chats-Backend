import { z } from 'zod';
import { formDataMentionsSchema } from './message-mention.schema';

export const uploadGroupMessageSchema = z.object({
  content: z.string().trim().max(5000).optional(),
  mentions: formDataMentionsSchema,
});

export type UploadGroupMessageDto = z.infer<typeof uploadGroupMessageSchema>;
