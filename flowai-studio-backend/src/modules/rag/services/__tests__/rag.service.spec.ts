import { RAGService } from '../rag.service';

describe('RAGService document processing', () => {
  const createService = (overrides: any = {}) => {
    const prisma = {
      knowledgeBase: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'kb-1',
          chunkSize: 500,
          chunkOverlap: 50,
        }),
      },
      document: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      batchInsertVectorChunks: jest.fn().mockResolvedValue(undefined),
      ...overrides.prisma,
    };
    const embeddingProvider = {
      embedBatch: jest.fn().mockResolvedValue({
        results: [{ content: 'hello', embedding: [0.1, 0.2] }],
        failedIndices: [],
        totalTokenUsage: 1,
      }),
      ...overrides.embeddingProvider,
    };
    const vectorStore = {
      storeType: 'pgvector',
      upsert: jest.fn().mockResolvedValue(undefined),
      ...overrides.vectorStore,
    };
    const service = new RAGService(
      prisma as any,
      { create: jest.fn().mockReturnValue(embeddingProvider) } as any,
      { create: jest.fn().mockReturnValue(vectorStore) } as any,
      null as any,
      null as any,
      { deleteByPrefix: jest.fn().mockResolvedValue(undefined) } as any,
    );
    return { service, prisma, embeddingProvider, vectorStore };
  };

  it('writes pgvector chunks once and marks the document completed', async () => {
    const { service, prisma, vectorStore } = createService();

    await (service as any).processAndEmbedDocument('doc-1', 'hello', 'kb-1');

    expect(vectorStore.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.batchInsertVectorChunks).not.toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'completed' },
    });
  });

  it('does not write empty embeddings when a chunk embedding fails', async () => {
    const { service, embeddingProvider, vectorStore, prisma } = createService();
    embeddingProvider.embedBatch.mockResolvedValue({
      results: [{ content: 'hello', embedding: [] }],
      failedIndices: [0],
      totalTokenUsage: 0,
    });

    await expect((service as any).processAndEmbedDocument('doc-1', 'hello', 'kb-1'))
      .rejects.toThrow('Embedding failed for 1 chunk(s)');
    expect(vectorStore.upsert).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('removes NUL characters before creating an uploaded document', async () => {
    const { service, prisma } = createService();
    const testService = service as any;
    testService.findKnowledgeBaseById = jest.fn().mockResolvedValue({ id: 'kb-1' });
    testService.parsePdf = jest.fn().mockResolvedValue('A\u0000B');
    testService.processAndEmbedDocument = jest.fn().mockResolvedValue(undefined);
    testService.invalidateKBCache = jest.fn().mockResolvedValue(undefined);

    await service.uploadDocument('user-1', 'kb-1', {
      originalname: 'sample.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF'),
      size: 4,
    } as any);

    expect(prisma.document.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ content: 'AB' }),
    }));
  });

  it('logs when a failed document cannot be marked as failed', async () => {
    const { service, prisma } = createService();
    const testService = service as any;
    testService.findKnowledgeBaseById = jest.fn().mockResolvedValue({ id: 'kb-1' });
    testService.parsePdf = jest.fn().mockResolvedValue('content');
    testService.processAndEmbedDocument = jest.fn().mockRejectedValue(new Error('embedding failed'));
    testService.invalidateKBCache = jest.fn().mockResolvedValue(undefined);
    prisma.document.update.mockRejectedValue(new Error('database unavailable'));
    const loggerError = jest.spyOn(testService.logger, 'error').mockImplementation();

    await service.uploadDocument('user-1', 'kb-1', {
      originalname: 'sample.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF'),
      size: 4,
    } as any);
    await new Promise((resolve) => setImmediate(resolve));

    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to mark document doc-1 as failed: database unavailable'),
    );
  });
});
