import { PgVectorStore } from '../pgvector-store.provider';

describe('PgVectorStore', () => {
  it('inserts every required document_chunks column using Prisma column names', async () => {
    const prisma: any = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    prisma.$transaction = jest.fn(async (callback: (client: any) => Promise<void>) => callback(prisma));
    const store = new PgVectorStore(prisma as any);

    await store.upsert('kb-1', [
      {
        id: 'doc-1_chunk_0',
        content: 'chunk content',
        embedding: [0.1, 0.2],
        metadata: {
          documentId: 'doc-1',
          knowledgeBaseId: 'kb-1',
          chunkIndex: 0,
          startIndex: 0,
          endIndex: 13,
        },
      },
    ]);

    const insertSql = prisma.$executeRaw.mock.calls[1][0] as { sql: string };
    expect(insertSql.sql).toContain('"chunkIndex"');
    expect(insertSql.sql).toContain('"startIndex"');
    expect(insertSql.sql).toContain('"endIndex"');
    expect(insertSql.sql).toContain('"documentId"');
    expect(insertSql.sql).toContain('"createdAt"');
    expect(insertSql.sql).not.toContain('created_at');
  });

  it('validates metadata before deleting existing chunks', async () => {
    const prisma: any = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    prisma.$transaction = jest.fn(async (callback: (client: any) => Promise<void>) => callback(prisma));
    const store = new PgVectorStore(prisma as any);

    await expect(store.upsert('kb-1', [{
      id: 'doc-1_chunk_0',
      content: 'chunk content',
      embedding: [0.1, 0.2],
      metadata: { documentId: 'doc-1' },
    }])).rejects.toThrow('missing required chunk fields');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
