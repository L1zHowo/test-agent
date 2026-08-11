import type { AgentNodeData } from '@flowai/shared-contracts';
import { AgentNodeExecutor } from '../services/node-executors/agent-node.executor';

describe('AgentNodeExecutor', () => {
  const baseData: AgentNodeData = {
    label: 'Supervisor',
    agentMode: 'supervisor',
    strategy: 'react',
    model: 'qwen-turbo',
    systemPrompt: '',
    userPrompt: 'Handle this task',
    temperature: 0.7,
    maxTokens: 2048,
    maxIterations: 10,
    toolIds: [],
    knowledgeBaseIds: [],
    ragEnabled: false,
    memoryEnabled: false,
    memoryWindowSize: 10,
    workers: [],
  };

  const result = {
    result: 'done',
    messages: [],
    trace: [],
    toolCallCount: 0,
    ragCallCount: 0,
    iterations: 1,
    duration: 1,
    success: true,
    terminationReason: 'completed',
  };

  it('uses the dedicated supervisor model when configured', async () => {
    const execute = jest.fn().mockResolvedValue(result);
    const executor = new AgentNodeExecutor({ execute } as any);

    await executor.execute({
      data: { ...baseData, supervisorModel: 'qwen-plus' },
    }, {});

    expect(execute.mock.calls[0][0].supervisor.model).toBe('qwen-plus');
  });

  it('falls back to the shared model for existing workflows', async () => {
    const execute = jest.fn().mockResolvedValue(result);
    const executor = new AgentNodeExecutor({ execute } as any);

    await executor.execute({ data: baseData }, {});

    expect(execute.mock.calls[0][0].supervisor.model).toBe('qwen-turbo');
  });
});
