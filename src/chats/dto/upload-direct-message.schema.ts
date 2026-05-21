import { z } from 'zod';

export const uploadDirectMessageSchema = z.object({
  // FormData sends numbers as strings, so coerce
  participantUserId: z.coerce.number().int().positive(),
  content: z.string().trim().max(5000).optional(),
  replyToMessageUuid: z.string().uuid().optional(),
});

export type UploadDirectMessageDto = z.infer<typeof uploadDirectMessageSchema>;
