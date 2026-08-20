import { z } from 'zod';

export const editDirectMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content cannot be empty')
    .max(5000, 'Message content is too long'),
});

export type EditDirectMessageDto = z.infer<typeof editDirectMessageSchema>;
