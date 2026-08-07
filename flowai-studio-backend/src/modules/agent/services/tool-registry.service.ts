import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { McpService } from '../../mcp/mcp.service';
import { SkillService } from '../../skill/services/skill.service';
import { ToolCall, ToolDefinition, ToolResult } from '../interfaces/agent.interface';

export type ToolSource = 'builtin' | 'skill' | 'mcp';

export interface ToolExecutionContext {
  userId?: string;
  variables?: Record<string, any>;
}

export interface ToolRef {
  source: ToolSource;
  id: string;
  builtinType?: string;
  mcp?: {
    serverId: string;
    toolName: string;
  };
}

export interface RuntimeTool {
  id: string;
  ref: ToolRef;
  runtimeName: string;
  aliases: string[];
  displayName: string;
  description: string;
  inputSchema: any;
  serverName?: string;
}

export interface ToolRuntimeBundle {
  tools: RuntimeTool[];
  definitions: ToolDefinition[];
  toolMap: Map<string, RuntimeTool>;
}

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly mcpService: McpService,
  ) {}

  async buildRuntime(
    toolIds: string[],
    context?: ToolExecutionContext,
  ): Promise<ToolRuntimeBundle> {
    const tools = await this.loadTools(toolIds, context);
    const toolMap = this.buildToolMap(tools);
    const definitions = this.buildToolDefinitions(tools);
    return { tools, toolMap, definitions };
  }

  async executeToolCall(
    toolCall: ToolCall,
    toolMap: Map<string, RuntimeTool>,
    context?: ToolExecutionContext,
  ): Promise<ToolResult> {
    const toolInfo = toolMap.get(toolCall.name);

    if (!toolInfo) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result: { error: `Tool ${toolCall.name} not found` },
        success: false,
        error: `Tool ${toolCall.name} not found`,
      };
    }

    try {
      const resolvedArgs = this.resolveVariables(
        toolCall.arguments,
        context?.variables || {},
      );
      let result: any;

      if (toolInfo.ref.source === 'mcp') {
        const userId = this.requireUserId(context, toolInfo.displayName);
        result = await this.mcpService.callToolById(
          userId,
          toolInfo.ref.id,
          resolvedArgs,
        );
      } else if (toolInfo.ref.source === 'builtin') {
        result = await this.skillService.executeBuiltinSkill(
          toolInfo.ref.builtinType || toolInfo.ref.id,
          resolvedArgs,
        );
      } else {
        result = await this.skillService.executeSkill(
          toolInfo.ref.id,
          resolvedArgs,
          context?.userId,
        );
      }

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result,
        success: true,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async loadTools(
    toolIds: string[],
    context?: ToolExecutionContext,
  ): Promise<RuntimeTool[]> {
    if (!toolIds || toolIds.length === 0) {
      const builtinSkills = await this.skillService.getBuiltinSkills();
      return builtinSkills.map((skill, index) =>
        this.createRuntimeTool(
          {
            source: 'builtin',
            id: skill.type,
            builtinType: skill.type,
          },
          skill.name,
          skill.description,
          skill.inputSchema,
          index,
        ),
      );
    }

    const tools: RuntimeTool[] = [];

    for (const toolId of toolIds) {
      if (this.mcpService.isMcpToolId(toolId)) {
        const userId = this.requireUserId(context, toolId);
        const tool = await this.mcpService.findRuntimeTool(userId, toolId);
        tools.push(
          this.createRuntimeTool(
            {
              source: 'mcp',
              id: tool.id,
              mcp: { serverId: tool.serverId, toolName: tool.name },
            },
            tool.name || 'unknown',
            tool.description || '',
            tool.inputSchema,
            tools.length,
            tool.serverName,
          ),
        );
        continue;
      }

      try {
        const skill = await this.prisma.skill.findUnique({
          where: { id: toolId },
        });

        if (skill) {
          const inputSchema = skill.inputSchema
            ? typeof skill.inputSchema === 'string'
              ? JSON.parse(skill.inputSchema)
              : skill.inputSchema
            : undefined;

          tools.push(
            this.createRuntimeTool(
              {
                source: skill.type === 'builtin' ? 'builtin' : 'skill',
                id: skill.id,
                builtinType:
                  skill.type === 'builtin' ? skill.builtinType || skill.id : undefined,
              },
              skill.name || 'unknown',
              skill.description || '',
              inputSchema,
              tools.length,
            ),
          );
        }
      } catch {
        this.logger.warn(`Tool ${toolId} not found, skipping`);
      }
    }

    return tools;
  }

  private createRuntimeTool(
    ref: ToolRef,
    displayName: string,
    description: string,
    inputSchema: any,
    index: number,
    serverName?: string,
  ): RuntimeTool {
    const runtimeName =
      this.sanitizeToolName(`${ref.source}_${ref.id}`) || `tool_${index}`;
    const legacyName = this.sanitizeToolName(displayName);
    const aliases = legacyName && legacyName !== runtimeName ? [legacyName] : [];

    return {
      id: ref.id,
      ref,
      runtimeName,
      aliases,
      displayName,
      description,
      inputSchema,
      serverName,
    };
  }

  private buildToolMap(tools: RuntimeTool[]): Map<string, RuntimeTool> {
    const map = new Map<string, RuntimeTool>();

    for (const tool of tools) {
      map.set(tool.runtimeName, tool);
      for (const alias of tool.aliases) {
        if (!map.has(alias)) {
          map.set(alias, tool);
        }
      }
    }

    return map;
  }

  private buildToolDefinitions(tools: RuntimeTool[]): ToolDefinition[] {
    return tools.map((tool) => ({
      name: tool.runtimeName,
      description: tool.description,
      parameters: tool.inputSchema
        ? typeof tool.inputSchema === 'string'
          ? JSON.parse(tool.inputSchema)
          : tool.inputSchema
        : {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input for the tool' },
            },
          },
    }));
  }

  private sanitizeToolName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private requireUserId(
    context: ToolExecutionContext | undefined,
    toolName: string,
  ): string {
    if (!context?.userId) {
      throw new BadRequestException(
        `MCP tool "${toolName}" requires an authenticated user context`,
      );
    }
    return context.userId;
  }

  private resolveVariables(
    obj: Record<string, any>,
    context: Record<string, any>,
  ): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{(.+?)\}\}/g, (match, p1) => {
          const keys = p1.trim().split('.');
          let val: any = context;
          for (const k of keys) {
            if (val && typeof val === 'object' && k in val) {
              val = val[k];
            } else {
              return match;
            }
          }
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        });
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveVariables(value, context);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
}
