import { z } from 'zod';

export const createGroupChatSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  memberIds: z.array(z.number().int().positive()).min(1).max(99),
});

export type CreateGroupChatDto = z.infer<typeof createGroupChatSchema>;
