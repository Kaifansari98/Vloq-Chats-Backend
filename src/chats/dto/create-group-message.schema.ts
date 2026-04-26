import { z } from 'zod';

export const createGroupMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export type CreateGroupMessageDto = z.infer<typeof createGroupMessageSchema>;
