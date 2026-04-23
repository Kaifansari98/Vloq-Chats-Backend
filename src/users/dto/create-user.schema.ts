import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),

  password: z.string().min(6).optional(), // optional for google users

  organizationId: z.number(),
  userTypeId: z.number(),

  provider: z.enum(['EMAIL', 'GOOGLE']),
  providerId: z.string().optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
