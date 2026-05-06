import { z } from 'zod';

export const updateOrgSettingsSchema = z.object({
  isIpRestrictionEnabled: z.boolean(),
});

export type UpdateOrgSettingsDto = z.infer<typeof updateOrgSettingsSchema>;
