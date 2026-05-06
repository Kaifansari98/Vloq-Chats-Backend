import { z } from 'zod';

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type ListNotificationsDto = z.infer<typeof listNotificationsSchema>;
