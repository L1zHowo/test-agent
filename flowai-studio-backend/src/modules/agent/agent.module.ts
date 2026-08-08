/**
 * Agent 模块
 *
 * Phase 3.1: 多智能体架构
 * Phase 3.2: Qwen 模型支持
 *
 * 提供:
 * - AgentExecutorService: Agent 执行引擎
 * - LLMProviderFactory: Qwen Provider 工厂
 * - LLMModelService: 模型管理服务
 * - LLMModelController: 模型管理 API
 */
import { Module } from '@nestjs/common';
import { AgentExecutorService } from './services/agent-executor.service';
import { LLMModelService } from './services/llm-model.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { LLMProviderFactory } from './providers/llm-provider.factory';
import { LLMModelController } from './controllers/llm-model.controller';
import { SkillModule } from '../skill/skill.module';
import { McpModule } from '../mcp/mcp.module';
import { RAGModule } from '../rag/rag.module';
import { PrismaModule } from '../../common/modules/prisma.module';

@Module({
  imports: [SkillModule, McpModule, RAGModule, PrismaModule],
  controllers: [LLMModelController],
  providers: [AgentExecutorService, LLMModelService, LLMProviderFactory, ToolRegistryService],
  exports: [AgentExecutorService, LLMModelService, LLMProviderFactory, ToolRegistryService],
})
export class AgentModule {}
