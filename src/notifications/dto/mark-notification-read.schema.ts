import { z } from 'zod';

export const markNotificationReadSchema = z.object({
  notificationUuid: z.string().uuid(),
});

export type MarkNotificationReadDto = z.infer<typeof markNotificationReadSchema>;
