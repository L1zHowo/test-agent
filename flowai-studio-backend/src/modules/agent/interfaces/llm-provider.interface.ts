/**
 * LLM Provider 接口定义
 *
 * Qwen LLM 接口
 *
 */

import { ToolDefinition as _ToolDefinition, ToolCall as _ToolCall } from './agent.interface';

// Re-export for convenience
export type ToolDefinition = _ToolDefinition;
export type ToolCall = _ToolCall;

// ============================================================
// LLM Provider 核心接口
// ============================================================

/** LLM Provider 类型 */
export type LLMProviderType = 'qwen';

/** LLM 模型能力 */
export interface LLMModelCapabilities {
  /** 是否支持 Function Calling / Tool Use */
  functionCalling: boolean;
  /** 是否支持视觉（图片输入） */
  vision: boolean;
  /** 是否支持流式输出 */
  streaming: boolean;
  /** 是否支持 JSON Mode */
  jsonMode: boolean;
  /** 最大上下文长度 (tokens) */
  maxContextTokens: number;
  /** 最大输出长度 (tokens) */
  maxOutputTokens: number;
}

/** 模型信息 */
export interface LLMModelInfo {
  /** Qwen 模型 ID */
  id: string;
  /** 显示名称 */
  displayName: string;
  /** 所属 Provider */
  provider: LLMProviderType;
  /** 模型能力 */
  capabilities: LLMModelCapabilities;
  /** 输入价格 (USD per 1M tokens) */
  inputPricePer1M?: number;
  /** 输出价格 (USD per 1M tokens) */
  outputPricePer1M?: number;
  /** 是否为默认模型 */
  isDefault?: boolean;
  /** 排序权重 */
  order?: number;
}

/** LLM Provider 配置 */
export interface LLMProviderConfig {
  /** API Key */
  apiKey?: string;
  /** API Base URL */
  baseUrl?: string;
  /** 默认模型 */
  defaultModel?: string;
  /** 请求超时 (ms) */
  timeout?: number;
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 额外配置（各 Provider 特有） */
  extra?: Record<string, any>;
}

/** LLM 聊天参数 */
export interface LLMChatParams {
  /** 消息列表 */
  messages: Array<{ role: string; content: string }>;
  /** 模型 ID */
  model?: string;
  /** 温度 */
  temperature?: number;
  /** 最大输出 Token 数 */
  maxTokens?: number;
  /** 工具定义 */
  tools?: ToolDefinition[];
  /** 是否启用 JSON Mode */
  jsonMode?: boolean;
  /** 停止序列 */
  stopSequences?: string[];
}

/** LLM Token 使用量 */
export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** LLM 响应 */
export interface LLMResponse {
  /** 文本内容 */
  content: string;
  /** 工具调用 */
  toolCalls?: ToolCall[];
  /** Token 使用量 */
  usage?: LLMTokenUsage;
  /** 完成原因 (stop/tool_calls/length) */
  finishReason?: string;
  /** 使用的模型 */
  model?: string;
}

/** LLM Provider 接口 */
export interface ILLMProvider {
  /** Provider 名称 */
  readonly name: LLMProviderType;
  /** 默认模型 */
  readonly defaultModel: string;
  /** 支持的模型列表 */
  readonly supportedModels: LLMModelInfo[];

  /** 聊天补全（非流式） */
  chat(params: LLMChatParams): Promise<LLMResponse>;

  /** 流式聊天补全 */
  chatStream(params: Omit<LLMChatParams, 'tools' | 'jsonMode'>): AsyncIterable<string>;

  /** 健康检查 */
  healthCheck(): Promise<boolean>;

  /** 估算 Token 数 */
  estimateTokens(text: string): number;

  /** 构建工具定义 */
  buildToolDefinitions(skills: Array<{
    id: string;
    name: string;
    description: string;
    inputSchema?: any;
  }>): ToolDefinition[];
}
