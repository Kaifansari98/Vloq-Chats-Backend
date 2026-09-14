import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

describe('group shared media', () => {
  function repository(query: jest.Mock) {
    return Object.assign(Object.create(PrismaService.prototype) as object, { pool: { query } }) as unknown as PrismaService;
  }
  it('lists documents from different senders using actual attachment columns', async () => {
    const rows = ['Alice', 'Bob'].map((senderName, i) => ({ uuid: `doc-${i}`, fileName: `${i}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSizeBytes: '8192', storageKey: `/uploads/${i}.xlsx`, senderName }));
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 42 }] }).mockResolvedValueOnce({ rows });
    const result = await repository(query).findGroupMedia({ organizationId: 3, currentUserId: 7, conversationUuid: 'group', type: 'docs' });
    expect(result.map(item => item.senderName)).toEqual(['Alice', 'Bob']);
    expect(result[0]).toMatchObject({ name: '0.xlsx', sizeBytes: 8192, url: '/uploads/0.xlsx' });
    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('ma.name AS "fileName"');
    expect(sql).toContain('ma.url AS "storageKey"');
    expect(sql).toContain('m."senderId"');
    expect(sql).not.toContain('m."senderUserId"');
    expect(sql).toContain('m."isDeleted" = false');
    expect(params).toEqual([42]);
    expect(query.mock.calls[0][1]).toEqual(['group', 3, 7]);
  });
  it('denies access before reading attachments when the group is inaccessible', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await expect(repository(query).findGroupMedia({ organizationId: 3, currentUserId: 8, conversationUuid: 'group', type: 'docs' })).rejects.toThrow(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('separates documents and visual media with the same MIME classification as counts', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 42 }] }).mockResolvedValueOnce({ rows: [ { uuid: 'photo', mimeType: 'image/jpeg' }, { uuid: 'doc', mimeType: 'application/pdf', fileSizeBytes: '12' } ] });
    const result = await repository(query).findGroupMedia({ organizationId: 3, currentUserId: 7, conversationUuid: 'group', type: 'docs' });
    expect(result.map(item => item.id)).toEqual(['doc']);
  });
});
