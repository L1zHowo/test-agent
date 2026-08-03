import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RAGController } from './rag.controller';
import { EmbeddingFactory } from './factories/embedding.factory';
import { VectorStoreFactory } from './factories/vector-store.factory';
import { BM25KeywordService } from './services/bm25-keyword.service';
import { RAGService } from './services/rag.service';
import { RRFFusionService } from './services/rrf-fusion.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  ],
  controllers: [RAGController],
  providers: [
    RAGService,
    EmbeddingFactory,
    VectorStoreFactory,
    BM25KeywordService,
    RRFFusionService,
  ],
  exports: [
    RAGService,
    EmbeddingFactory,
    VectorStoreFactory,
    BM25KeywordService,
    RRFFusionService,
  ],
})
export class RAGModule {}
