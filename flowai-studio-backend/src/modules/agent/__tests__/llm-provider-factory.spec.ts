import { ConfigService } from '@nestjs/config';
import { LLMProviderFactory } from '../providers/llm-provider.factory';

describe('LLMProviderFactory', () => {
  let factory: LLMProviderFactory;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'QWEN_API_KEY') return 'test-qwen-key';
        return defaultValue ?? '';
      }),
    };

    factory = new LLMProviderFactory(configService as unknown as ConfigService);
  });

  it('registers only Qwen', () => {
    expect(factory.getRegisteredTypes()).toEqual([
      expect.objectContaining({ type: 'qwen' }),
    ]);
  });

  it('creates and caches the Qwen provider', () => {
    const first = factory.create('qwen');
    const second = factory.create('qwen');

    expect(first.name).toBe('qwen');
    expect(first.defaultModel).toBe('qwen-turbo');
    expect(first).toBe(second);
  });

  it('creates a separate instance when overrides are provided', () => {
    const defaultProvider = factory.create('qwen');
    const overriddenProvider = factory.create('qwen', { apiKey: 'custom-key' });

    expect(overriddenProvider.name).toBe('qwen');
    expect(overriddenProvider).not.toBe(defaultProvider);
  });

  it('routes every model request through Qwen', () => {
    expect(factory.getProviderForModel('qwen-plus').name).toBe('qwen');
    expect(factory.getProviderForModel('unsupported-model').name).toBe('qwen');
  });

  it('returns only Qwen models', () => {
    const models = factory.getAllModels();
    const groups = factory.getModelsGroupByProvider();

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.provider === 'qwen')).toBe(true);
    expect(Object.keys(groups)).toEqual(['qwen']);
  });

  it('returns model information', () => {
    expect(factory.getModelInfo('qwen-turbo')?.provider).toBe('qwen');
  });

  it('clears the cached instance', () => {
    const first = factory.create('qwen');
    factory.clearCache();
    const second = factory.create('qwen');

    expect(second).not.toBe(first);
  });
});
