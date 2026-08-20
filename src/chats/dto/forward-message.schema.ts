import { z } from 'zod';

export const forwardMessageSchema = z.object({
  messageUuid: z.string().min(1, 'messageUuid is required'),
  targetDirectParticipantUserIds: z
    .array(z.number().int().positive())
    .optional()
    .default([]),
  targetGroupConversationUuids: z
    .array(z.string().min(1))
    .optional()
    .default([]),
});

export type ForwardMessageDto = z.infer<typeof forwardMessageSchema>;
