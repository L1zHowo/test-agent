import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingProvider,
  EmbeddingProviderConfig,
} from '../interfaces/embedding-provider.interface';
import { QwenEmbeddingProvider } from '../providers/embedding/qwen-embedding.provider';

@Injectable()
export class EmbeddingFactory {
  private provider?: EmbeddingProvider;

  constructor(private readonly configService: ConfigService) {}

  create(
    _providerType: 'qwen' = 'qwen',
    overrides?: Partial<EmbeddingProviderConfig>,
  ): EmbeddingProvider {
    if (this.provider && !overrides) {
      return this.provider;
    }

    const provider = new QwenEmbeddingProvider({
      apiKey:
        this.configService.get<string>('QWEN_EMBEDDING_API_KEY')
        || this.configService.get<string>('QWEN_API_KEY')
        || '',
      baseUrl: this.configService.get<string>(
        'QWEN_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ),
      model: this.configService.get<string>('QWEN_EMBEDDING_MODEL', 'text-embedding-v3'),
      dimensions: this.configService.get<number>('QWEN_EMBEDDING_DIMENSION', 1024),
      ...overrides,
    });

    if (!overrides) {
      this.provider = provider;
    }

    return provider;
  }

  getDefaultProvider(): EmbeddingProvider {
    return this.create('qwen');
  }

  getRegisteredTypes(): string[] {
    return ['qwen'];
  }

  clearCache(): void {
    this.provider = undefined;
  }
}
