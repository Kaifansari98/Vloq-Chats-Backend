import { z } from 'zod';

export const searchMessagesSchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type SearchMessagesDto = z.infer<typeof searchMessagesSchema>;
