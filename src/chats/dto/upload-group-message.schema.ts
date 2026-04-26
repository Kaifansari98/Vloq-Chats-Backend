import { z } from 'zod';

export const uploadGroupMessageSchema = z.object({
  content: z.string().trim().max(5000).optional(),
});

export type UploadGroupMessageDto = z.infer<typeof uploadGroupMessageSchema>;
