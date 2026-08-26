import { z } from 'zod';

export const addGroupMembersSchema = z.object({
  memberIds: z.array(z.number().int().positive()).min(1).max(99),
});

export type AddGroupMembersDto = z.infer<typeof addGroupMembersSchema>;
