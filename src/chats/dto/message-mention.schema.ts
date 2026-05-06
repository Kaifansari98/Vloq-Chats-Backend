import { z } from 'zod';

export const messageMentionSchema = z.object({
  mentionedUserId: z.number().int().positive(),
  offset: z.number().int().min(0),
  length: z.number().int().positive(),
});

export const formDataMentionsSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.array(messageMentionSchema).optional());
