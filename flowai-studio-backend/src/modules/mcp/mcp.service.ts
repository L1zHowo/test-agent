import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { McpClient, McpTool, McpToolResult } from './mcp-client';

/**
 * MCP 服务器配置 DTO
 */
export interface CreateMcpServerDto {
  name: string;
  description?: string;
  transportType?: 'stdio';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface UpdateMcpServerDto {
  name?: string;
  description?: string;
  transportType?: 'stdio';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  isActive?: boolean;
}

export interface McpRuntimeTool extends McpTool {
  id: string;
  source: 'mcp';
  serverId: string;
  serverName: string;
}

export interface McpToolRef {
  source: 'mcp';
  serverId: string;
  toolName: string;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  // 活跃的 MCP Client 连接池：key = serverId
  private clients = new Map<string, McpClient>();

  constructor(private prisma: PrismaService) {}

  // ========== CRUD ==========

  async create(userId: string, dto: CreateMcpServerDto) {
    if (dto.transportType && dto.transportType !== 'stdio') {
      throw new BadRequestException('当前仅支持 stdio 传输方式');
    }
    if (!dto.command) {
      throw new BadRequestException('stdio 模式必须提供启动命令 (command)');
    }

    return this.prisma.mcpServer.create({
      data: {
        name: dto.name,
        description: dto.description,
        transportType: dto.transportType || 'stdio',
        command: dto.command,
        args: dto.args ? JSON.stringify(dto.args) : null,
        env: dto.env ? JSON.stringify(dto.env) : null,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    const servers = await this.prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // 附加连接状态
    return servers.map((s) => ({
      ...s,
      args: s.args ? JSON.parse(s.args) : [],
      env: s.env ? JSON.parse(s.env) : {},
      isConnected: this.clients.has(s.id) && this.clients.get(s.id)!.isConnected(),
    }));
  }

  async findOne(userId: string, id: string) {
    const server = await this.prisma.mcpServer.findUnique({ where: { id } });
    if (!server || server.userId !== userId) {
      throw new NotFoundException('MCP 服务器不存在');
    }
    return {
      ...server,
      args: server.args ? JSON.parse(server.args) : [],
      env: server.env ? JSON.parse(server.env) : {},
      isConnected: this.clients.has(id) && this.clients.get(id)!.isConnected(),
    };
  }

  async update(userId: string, id: string, dto: UpdateMcpServerDto) {
    await this.findOne(userId, id);
    if (dto.transportType && dto.transportType !== 'stdio') {
      throw new BadRequestException('当前仅支持 stdio 传输方式');
    }

    // 如果正在连接，先断开
    if (this.clients.has(id)) {
      this.clients.get(id)!.disconnect();
      this.clients.delete(id);
    }

    return this.prisma.mcpServer.update({
      where: { id },
      data: {
        ...dto,
        args: dto.args ? JSON.stringify(dto.args) : undefined,
        env: dto.env ? JSON.stringify(dto.env) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    // 断开连接
    if (this.clients.has(id)) {
      this.clients.get(id)!.disconnect();
      this.clients.delete(id);
    }

    return this.prisma.mcpServer.delete({ where: { id } });
  }

  // ========== 连接管理 ==========

  /**
   * 连接到指定 MCP Server
   */
  async connectServer(userId: string, serverId: string): Promise<{ tools: McpTool[] }> {
    const server = await this.findOne(userId, serverId);

    if (server.transportType !== 'stdio') {
      throw new BadRequestException('当前仅支持 stdio 传输方式');
    }

    if (!server.command) {
      throw new BadRequestException('MCP 服务器未配置启动命令');
    }

    // 如果已连接，先断开
    if (this.clients.has(serverId)) {
      this.clients.get(serverId)!.disconnect();
    }

    const args = Array.isArray(server.args) ? server.args : [];
    const env = typeof server.env === 'object' && server.env ? server.env : {};

    const client = new McpClient(server.command, args, env as Record<string, string>);

    try {
      await client.connect();
      this.clients.set(serverId, client);
      this.logger.log(`MCP Server "${server.name}" 连接成功`);

      const tools = await client.listTools();
      return { tools };
    } catch (err) {
      client.disconnect();
      throw new BadRequestException(
        `连接 MCP Server "${server.name}" 失败: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * 断开指定 MCP Server
   */
  async disconnectServer(userId: string, serverId: string): Promise<void> {
    await this.findOne(userId, serverId);

    if (this.clients.has(serverId)) {
      this.clients.get(serverId)!.disconnect();
      this.clients.delete(serverId);
      this.logger.log(`MCP Server ${serverId} 已断开`);
    }
  }

  // ========== 工具操作 ==========

  /**
   * 获取已连接服务器的工具列表
   */
  async listTools(userId: string, serverId: string): Promise<McpTool[]> {
    await this.findOne(userId, serverId);

    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      throw new BadRequestException('MCP Server 未连接，请先连接');
    }

    return client.listTools();
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(
    userId: string,
    serverId: string,
    toolName: string,
    args: Record<string, any> = {},
  ): Promise<McpToolResult> {
    await this.findOne(userId, serverId);

    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      throw new BadRequestException('MCP Server 未连接，请先连接');
    }

    try {
      return await client.callTool(toolName, args);
    } catch (err) {
      throw new BadRequestException(
        `调用工具 "${toolName}" 失败: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * 获取所有已连接服务器的所有工具（聚合）
   */
  async listAllTools(userId: string): Promise<Array<McpRuntimeTool>> {
    const servers = await this.findAll(userId);
    const allTools: Array<McpRuntimeTool> = [];

    for (const server of servers) {
      const client = this.clients.get(server.id);
      if (client && client.isConnected()) {
        try {
          const tools = await client.listTools();
          for (const tool of tools) {
            allTools.push({
              ...tool,
              id: this.createToolId(server.id, tool.name),
              source: 'mcp',
              serverId: server.id,
              serverName: server.name,
            });
          }
        } catch {
          // 跳过出错的服务器
        }
      }
    }

    return allTools;
  }

  isMcpToolId(toolId: string): boolean {
    return toolId.startsWith('mcp:');
  }

  createToolId(serverId: string, toolName: string): string {
    return `mcp:${serverId}:${encodeURIComponent(toolName)}`;
  }

  parseToolId(toolId: string): McpToolRef {
    const parts = toolId.split(':');
    if (parts.length < 3 || parts[0] !== 'mcp') {
      throw new BadRequestException('Invalid MCP tool id');
    }

    return {
      source: 'mcp',
      serverId: parts[1],
      toolName: decodeURIComponent(parts.slice(2).join(':')),
    };
  }

  async findRuntimeTool(userId: string, toolId: string): Promise<McpRuntimeTool> {
    const { serverId, toolName } = this.parseToolId(toolId);
    const server = await this.findOne(userId, serverId);
    const tools = await this.listTools(userId, serverId);
    const tool = tools.find((item) => item.name === toolName);

    if (!tool) {
      throw new NotFoundException('MCP tool not found');
    }

    return {
      ...tool,
      id: toolId,
      source: 'mcp',
      serverId,
      serverName: server.name,
    };
  }

  async callToolById(
    userId: string,
    toolId: string,
    args: Record<string, any> = {},
  ): Promise<McpToolResult> {
    const { serverId, toolName } = this.parseToolId(toolId);
    return this.callTool(userId, serverId, toolName, args);
  }

  /**
   * 应用关闭时清理所有连接
   */
  onModuleDestroy() {
    for (const [id, client] of this.clients) {
      client.disconnect();
    }
    this.clients.clear();
  }
}
