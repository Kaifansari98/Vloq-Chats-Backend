import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { PrismaService, type UserMasterRecord } from '../prisma/prisma.service';

describe('direct contact info and media', () => {
  const user = { id: 7, organizationId: 3 } as UserMasterRecord;
  it('validates participant IDs and media categories', () => {
    const service = { getDirectDetails: jest.fn(), getDirectMedia: jest.fn() };
    const controller = new ChatsController(service as unknown as ChatsService);
    const req = { user } as Parameters<ChatsController['getDirectDetails']>[0];
    controller.getDirectDetails(req, '9');
    expect(service.getDirectDetails).toHaveBeenCalledWith(user, 9);
    controller.getDirectMedia(req, '9', 'docs');
    expect(service.getDirectMedia).toHaveBeenCalledWith(user, 9, 'docs');
    expect(() => controller.getDirectDetails(req, '-1')).toThrow(BadRequestException);
    expect(() => controller.getDirectMedia(req, '9', 'unknown')).toThrow(BadRequestException);
  });
  it('requires both active participants and scopes the lookup to their tenant and direct key', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 42, uuid: 'direct' }] }).mockResolvedValueOnce({ rows: [
      { uuid: 'a', mimeType: 'application/pdf', fileName: 'a.pdf', fileSizeBytes: '12', senderName: 'Me' },
      { uuid: 'b', mimeType: 'application/pdf', fileName: 'b.pdf', fileSizeBytes: '24', senderName: 'Peer' },
    ] });
    const repository = Object.assign(Object.create(PrismaService.prototype) as object, { pool: { query } }) as unknown as PrismaService;
    const result = await repository.findDirectSharedMedia({ organizationId: 3, currentUserId: 7, participantUserId: 9, type: 'docs' });
    expect(query.mock.calls[0][1]).toEqual([3, 7, 9, '7_9']);
    expect(query.mock.calls[0][0]).toContain('me."isActive" = true');
    expect(query.mock.calls[0][0]).toContain('peer."isActive" = true');
    expect(result.items.map(item => item.senderName)).toEqual(['Me', 'Peer']);
    expect(query.mock.calls[1][1]).toEqual([42]);
  });
  it('returns empty media without reading attachments when no accessible direct chat exists', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = Object.assign(Object.create(PrismaService.prototype) as object, { pool: { query } }) as unknown as PrismaService;
    expect(await repository.findDirectSharedMedia({ organizationId: 3, currentUserId: 7, participantUserId: 9, type: 'all' })).toEqual({ conversationUuid: null, items: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects a participant from another organization before reading media', async () => {
    const prisma = { userMaster: { findUnique: jest.fn().mockResolvedValue({ id: 9, organizationId: 4, isActive: true }) }, findDirectSharedMedia: jest.fn() };
    const service = Object.assign(Object.create(ChatsService.prototype) as object, { prisma }) as unknown as ChatsService;
    await expect(service.getDirectDetails(user, 9)).rejects.toThrow(NotFoundException);
    await expect(service.getDirectMedia(user, 9, 'docs')).rejects.toThrow(NotFoundException);
    expect(prisma.findDirectSharedMedia).not.toHaveBeenCalled();
  });
});
