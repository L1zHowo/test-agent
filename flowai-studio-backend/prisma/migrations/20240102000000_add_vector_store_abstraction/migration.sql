-- 向量存储配置：Qwen Embedding + pgvector

-- Embedding Provider 固定为 Qwen
ALTER TABLE "knowledge_bases" ADD COLUMN IF NOT EXISTS "embedding_provider" TEXT NOT NULL DEFAULT 'qwen';

-- Vector Store 固定使用 pgvector
ALTER TABLE "knowledge_bases" ADD COLUMN IF NOT EXISTS "vector_store" TEXT NOT NULL DEFAULT 'pgvector';

UPDATE "knowledge_bases"
SET "embedding_provider" = 'qwen';