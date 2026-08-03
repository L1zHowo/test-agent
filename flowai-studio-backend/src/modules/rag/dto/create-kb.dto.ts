import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Embedding provider must be a string' })
  @IsIn(['qwen'], {
    message: 'Embedding provider must be qwen',
  })
  embeddingProvider?: string;

  @IsOptional()
  @IsString({ message: 'Embedding model must be a string' })
  @IsIn(['text-embedding-v3'], {
    message: 'Embedding model must be text-embedding-v3',
  })
  embeddingModel?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Embedding dimension must be a number' })
  @IsIn([1024], {
    message: 'Embedding dimension must be 1024',
  })
  embeddingDimension?: number;

  @IsOptional()
  @IsString({ message: 'Vector store must be a string' })
  @IsIn(['pgvector'], {
    message: 'Vector store must be pgvector',
  })
  vectorStore?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Chunk size must be a number' })
  @Min(100, { message: 'Chunk size must be at least 100' })
  @Max(2000, { message: 'Chunk size must not exceed 2000' })
  chunkSize?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Chunk overlap must be a number' })
  @Min(0, { message: 'Chunk overlap must be at least 0' })
  @Max(500, { message: 'Chunk overlap must not exceed 500' })
  chunkOverlap?: number;

  @IsOptional()
  @IsNumber({}, { message: 'TopK must be a number' })
  @Min(1, { message: 'TopK must be at least 1' })
  @Max(20, { message: 'TopK must not exceed 20' })
  topK?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Similarity threshold must be a number' })
  @Min(0, { message: 'Similarity threshold must be at least 0' })
  @Max(1, { message: 'Similarity threshold must not exceed 1' })
  similarityThreshold?: number;

  @IsOptional()
  @IsString({ message: 'Retrieval mode must be a string' })
  @IsIn(['vector', 'keyword', 'hybrid'], {
    message: 'Retrieval mode must be vector, keyword, or hybrid',
  })
  retrievalMode?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Vector weight must be a number' })
  @Min(0, { message: 'Vector weight must be at least 0' })
  @Max(1, { message: 'Vector weight must not exceed 1' })
  vectorWeight?: number;

  @IsOptional()
  @IsNumber({}, { message: 'RRF K must be a number' })
  @Min(1, { message: 'RRF K must be at least 1' })
  @Max(200, { message: 'RRF K must not exceed 200' })
  rrfK?: number;
}
