import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  userTypeId: z.number().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
