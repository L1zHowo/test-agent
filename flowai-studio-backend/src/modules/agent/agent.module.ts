/**
 * Agent 模块
 *
 * Phase 3.1: 多智能体架构
 * Phase 3.2: Qwen 模型支持
 * Phase 6.2: 模型调用成本统计
 *
 * 提供:
 * - AgentExecutorService: Agent 执行引擎
 * - LLMProviderFactory: Qwen Provider 工厂
 * - LLMModelService: 模型管理服务
 * - LLMModelController: 模型管理 API
 * - TokenUsageService: Token 使用量统计 + 成本报表
 * - TokenUsageController: 成本统计 API
 */
import { Module } from '@nestjs/common';
import { AgentExecutorService } from './services/agent-executor.service';
import { LLMModelService } from './services/llm-model.service';
import { TokenUsageService } from './services/token-usage.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { LLMProviderFactory } from './providers/llm-provider.factory';
import { LLMModelController } from './controllers/llm-model.controller';
import { TokenUsageController } from './controllers/token-usage.controller';
import { SkillModule } from '../skill/skill.module';
import { McpModule } from '../mcp/mcp.module';
import { RAGModule } from '../rag/rag.module';
import { PrismaModule } from '../../common/modules/prisma.module';

@Module({
  imports: [SkillModule, McpModule, RAGModule, PrismaModule],
  controllers: [LLMModelController, TokenUsageController],
  providers: [AgentExecutorService, LLMModelService, LLMProviderFactory, TokenUsageService, ToolRegistryService],
  exports: [AgentExecutorService, LLMModelService, LLMProviderFactory, TokenUsageService, ToolRegistryService],
})
export class AgentModule {}
