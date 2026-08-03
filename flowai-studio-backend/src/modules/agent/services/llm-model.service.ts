import { Injectable } from '@nestjs/common';
import { LLMProviderFactory } from '../providers/llm-provider.factory';
import {
  LLMModelInfo,
  LLMProviderType,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class LLMModelService {
  constructor(private readonly providerFactory: LLMProviderFactory) {}

  getModelsGroupByProvider(): Record<string, {
    provider: LLMProviderType;
    description: string;
    models: LLMModelInfo[];
  }> {
    const provider = this.providerFactory.create('qwen');
    return {
      qwen: {
        provider: 'qwen',
        description: '通义千问 Qwen Turbo/Plus/Max/Long',
        models: provider.supportedModels,
      },
    };
  }

  getAllModels(): LLMModelInfo[] {
    return this.providerFactory.getAllModels();
  }

  getModelInfo(modelId: string): LLMModelInfo | undefined {
    return this.providerFactory.getModelInfo(modelId);
  }

  async healthCheck(): Promise<Record<LLMProviderType, {
    available: boolean;
    models: number;
  }>> {
    return this.providerFactory.healthCheckAll();
  }

  estimateCost(modelId: string, promptTokens: number, completionTokens: number): {
    modelId: string;
    promptTokens: number;
    completionTokens: number;
    costUSD: number;
  } {
    return {
      modelId,
      promptTokens,
      completionTokens,
      costUSD: this.providerFactory.estimateCost(
        modelId,
        promptTokens,
        completionTokens,
      ),
    };
  }
}
