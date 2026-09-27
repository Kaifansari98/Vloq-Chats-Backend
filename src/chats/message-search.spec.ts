import { BadRequestException } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { PrismaService, type UserMasterRecord } from '../prisma/prisma.service';
import { searchMessagesSchema } from './dto/search-messages.schema';

describe('message search', () => {
  const user = { id: 7, organizationId: 3 } as UserMasterRecord;
  it('validates and normalizes the query and bounds pagination', () => {
    expect(searchMessagesSchema.parse({ q: ' hello ' })).toEqual({ q: 'hello', page: 1, limit: 25 });
    for (const query of [{ q: ' ' }, { q: 'a', page: 0 }, { q: 'a', limit: 101 }, { q: 'a', page: 1.5 }, { q: 'x'.repeat(201) }]) {
      expect(searchMessagesSchema.safeParse(query).success).toBe(false);
    }
  });
  it('routes each search with the authenticated user and rejects invalid direct participants', () => {
    const service = { searchDirectMessages: jest.fn(), searchGroupMessages: jest.fn() };
    const controller = new ChatsController(service as unknown as ChatsService);
    const req = { user } as Parameters<ChatsController['searchDirectMessages']>[0];
    controller.searchDirectMessages(req, { participantUserId: '9', q: ' hello ' });
    expect(service.searchDirectMessages).toHaveBeenCalledWith(user, 9, { q: 'hello', page: 1, limit: 25 });
    controller.searchGroupMessages(req, 'group-uuid', { q: 'team', page: '2' });
    expect(service.searchGroupMessages).toHaveBeenCalledWith(user, 'group-uuid', { q: 'team', page: 2, limit: 25 });
    expect(() => controller.searchDirectMessages(req, { participantUserId: '-1', q: 'hello' })).toThrow(BadRequestException);
    expect(() => controller.searchGroupMessages(req, 'group-uuid', { q: '' })).toThrow(BadRequestException);
  });
  it.each(['Direct', 'Group'])('%s search scopes SQL to active membership and tenant without marking messages read', async (kind) => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const markRead = jest.fn();
    const repository = Object.assign(Object.create(PrismaService.prototype) as object, {
      pool: { query }, markGroupConversationRead: markRead, markConversationNotificationsRead: markRead,
    }) as Record<string, (args: unknown) => Promise<unknown>>;
    await repository[`find${kind}Messages`]({ organizationId: 3, currentUserId: 7, participantUserId: 9, conversationUuid: 'group-uuid', search: { q: "100%_it's", page: 2, limit: 25 } });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('my_participant."isActive" = true');
    expect(sql).toContain('c."organizationId" = $3');
    expect(sql).toContain('m."isDeleted" = false');
    expect(sql).toContain('c."isDeleted" = false');
    expect(sql).toContain('strpos(lower(COALESCE(m.content');
    expect(sql).toContain('m."createdAt" DESC, m.id DESC');
    expect(sql).not.toContain("100%_it's");
    expect(values).toEqual(kind === 'Direct' ? [7, 9, 3, '7_9', "100%_it's", 26, 25] : [7, 'group-uuid', 3, "100%_it's", 26, 25]);
    expect(markRead).not.toHaveBeenCalled();
  });
});
