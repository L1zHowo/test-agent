/**
 * Qwen LLM Provider Factory
 *
 * The application intentionally exposes a single LLM provider. The factory
 * remains as the shared entry point used by Agent and model-management code.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  LLMModelInfo,
} from '../interfaces/llm-provider.interface';
import { QwenProvider } from './qwen.provider';

@Injectable()
export class LLMProviderFactory {
  private readonly logger = new Logger(LLMProviderFactory.name);
  private instance?: ILLMProvider;

  constructor(private readonly configService: ConfigService) {}

  create(
    _providerType: LLMProviderType = 'qwen',
    overrides?: Partial<LLMProviderConfig>,
  ): ILLMProvider {
    if (this.instance && !overrides) {
      return this.instance;
    }

    const provider = new QwenProvider({
      apiKey: this.configService.get<string>('QWEN_API_KEY', ''),
      baseUrl: this.configService.get<string>(
        'QWEN_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ),
      timeout: 60000,
      ...overrides,
    });

    if (!overrides) {
      this.instance = provider;
    }

    return provider;
  }

  getProviderForModel(modelId: string): ILLMProvider {
    if (!modelId.startsWith('qwen-')) {
      this.logger.warn(`Unsupported model "${modelId}", using Qwen provider`);
    }
    return this.create('qwen');
  }

  getRegisteredTypes(): Array<{ type: LLMProviderType; description: string }> {
    return [{
      type: 'qwen',
      description: '通义千问 Qwen Turbo/Plus/Max/Long',
    }];
  }

  getAllModels(): LLMModelInfo[] {
    return [...this.create('qwen').supportedModels]
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  getModelsGroupByProvider(): Record<LLMProviderType, LLMModelInfo[]> {
    return {
      qwen: this.getAllModels(),
    };
  }

  getModelInfo(modelId: string): LLMModelInfo | undefined {
    return this.create('qwen').supportedModels.find((model) => model.id === modelId);
  }

  async healthCheckAll(): Promise<Record<LLMProviderType, {
    available: boolean;
    models: number;
  }>> {
    const provider = this.create('qwen');
    try {
      return {
        qwen: {
          available: await provider.healthCheck(),
          models: provider.supportedModels.length,
        },
      };
    } catch {
      return {
        qwen: {
          available: false,
          models: provider.supportedModels.length,
        },
      };
    }
  }

  clearCache(): void {
    this.instance = undefined;
  }
}
