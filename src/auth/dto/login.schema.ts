import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),

  provider: z.enum(['EMAIL', 'GOOGLE']),
  providerId: z.string().optional(),

  organizationId: z.number(),
});

export type LoginDto = z.infer<typeof loginSchema>;
