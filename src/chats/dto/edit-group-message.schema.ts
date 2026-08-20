import { z } from 'zod';

export const editGroupMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content cannot be empty')
    .max(5000, 'Message content is too long'),
});

export type EditGroupMessageDto = z.infer<typeof editGroupMessageSchema>;
