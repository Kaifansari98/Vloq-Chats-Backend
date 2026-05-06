import { z } from 'zod';

export const addAllowedIpSchema = z.object({
  ipAddress: z
    .string()
    .min(1, 'IP address is required')
    .max(45)
    .regex(/^[\d.:\da-fA-F]+$/, 'Invalid IP address format'),
  label: z.string().max(100).optional(),
});

export type AddAllowedIpDto = z.infer<typeof addAllowedIpSchema>;
