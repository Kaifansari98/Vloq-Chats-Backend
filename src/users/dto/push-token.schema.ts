import { z } from 'zod';

export const pushTokenSchema = z.object({
  token: z.string().trim().min(1),
  userAgent: z.string().trim().max(1000).optional(),
});

export type PushTokenDto = z.infer<typeof pushTokenSchema>;
