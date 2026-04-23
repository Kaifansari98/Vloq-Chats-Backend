import { z } from 'zod';

export const createOrgSchema = z.object({
  organizationName: z.string().min(2),
  slug: z.string().min(2),

  email: z.string().email(),
  password: z.string().min(6),

  adminName: z.string().min(2),
});

export type CreateOrgDto = z.infer<typeof createOrgSchema>;
