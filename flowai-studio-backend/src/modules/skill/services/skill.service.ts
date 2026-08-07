import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';
import { executeBuiltinSkill } from '../utils/builtin-skills';
import axios from 'axios';

@Injectable()
export class SkillService {
  constructor(private prisma: PrismaService) {}

  // 创建工具
  async createSkill(userId: string, createSkillDto: CreateSkillDto) {
    // 检查工具名称是否已存在
    const existingSkill = await this.prisma.skill.findFirst({
      where: { name: createSkillDto.name, userId },
    });

    if (existingSkill) {
      throw new BadRequestException('Skill with this name already exists');
    }

    return this.prisma.skill.create({
      data: {
        name: createSkillDto.name,
        description: createSkillDto.description,
        type: createSkillDto.type,
        builtinType: createSkillDto.builtinType,
        isActive: createSkillDto.isActive,
        userId,
        config: createSkillDto.config ? JSON.stringify(createSkillDto.config) : undefined,
        inputSchema: createSkillDto.inputSchema ? JSON.stringify(createSkillDto.inputSchema) : undefined,
        outputSchema: createSkillDto.outputSchema ? JSON.stringify(createSkillDto.outputSchema) : undefined,
      },
    });
  }

  // 获取用户的所有工具
  async findSkills(userId: string) {
    return this.prisma.skill.findMany({
      where: { userId },
    });
  }

  // 获取工具详情
  async findSkillById(userId: string, id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    if (skill.userId !== userId) {
      throw new BadRequestException('You do not have permission to access this skill');
    }

    return skill;
  }

  // 更新工具
  async updateSkill(userId: string, id: string, updateSkillDto: UpdateSkillDto) {
    const skill = await this.findSkillById(userId, id);

    return this.prisma.skill.update({
      where: { id },
      data: {
        name: updateSkillDto.name,
        description: updateSkillDto.description,
        type: updateSkillDto.type,
        builtinType: updateSkillDto.builtinType,
        isActive: updateSkillDto.isActive,
        config: updateSkillDto.config ? JSON.stringify(updateSkillDto.config) : undefined,
        inputSchema: updateSkillDto.inputSchema ? JSON.stringify(updateSkillDto.inputSchema) : undefined,
        outputSchema: updateSkillDto.outputSchema ? JSON.stringify(updateSkillDto.outputSchema) : undefined,
      },
    });
  }

  // 删除工具
  async deleteSkill(userId: string, id: string) {
    const skill = await this.findSkillById(userId, id);

    return this.prisma.skill.delete({ where: { id } });
  }

  // 执行工具
  // userId 可选：从 controller 直接调用时传入做权限校验，工作流内部调用可省略
  async executeSkill(skillId: string, params: Record<string, any>, userId?: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    // 如果传入了 userId，做归属校验
    if (userId && skill.userId !== userId) {
      throw new BadRequestException('You do not have permission to execute this skill');
    }

    if (!skill.isActive) {
      throw new BadRequestException('Skill is not active');
    }

    if (skill.type === 'builtin') {
      return executeBuiltinSkill(skill.builtinType!, params);
    } else {
      return this.executeCustomSkill(skill, params);
    }
  }

  async executeBuiltinSkill(type: string, params: Record<string, any>) {
    return executeBuiltinSkill(type, params);
  }

  // 执行自定义工具
  private async executeCustomSkill(skill: any, params: Record<string, any>) {
    const config = JSON.parse(skill.config || '{}');
    const { url, method = 'POST', headers = {} } = config;

    if (!url) {
      return {
        success: true,
        data: params,
        message: 'Custom skill executed (Echo mode, no URL configured)',
      };
    }

    try {
      const response = await axios({
        url,
        method,
        headers,
        data: params,
        timeout: 15000, // 15 秒超时
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw new Error(`Custom skill execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 获取内置工具列表
  async getBuiltinSkills() {
    return [
      {
        type: 'time',
        name: '时间工具',
        description: '获取当前时间和日期',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        outputSchema: {
          datetime: 'string',
          timestamp: 'number',
          date: 'string',
          time: 'string',
        },
      },
      {
        type: 'http',
        name: 'HTTP请求',
        description: '发送HTTP请求',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: '请求的完整 URL',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
              default: 'GET',
              description: 'HTTP 请求方法',
            },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'HTTP 请求头',
            },
            body: {
              description: '请求体，可以是任意 JSON 值',
            },
          },
          required: ['url'],
          additionalProperties: false,
        },
        outputSchema: {
          status: 'number',
          data: 'any',
          headers: 'object',
        },
      },
      {
        type: 'json',
        name: 'JSON处理',
        description: '解析或生成JSON',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['parse', 'stringify'],
              description: 'parse 将 JSON 字符串解析为对象，stringify 将数据序列化为 JSON 字符串',
            },
            data: {
              description: '需要解析或序列化的数据；parse 时必须是 JSON 字符串',
            },
          },
          required: ['action', 'data'],
          additionalProperties: false,
        },
        outputSchema: {
          result: 'any',
        },
      },
      {
        type: 'regex',
        name: '正则表达式',
        description: '使用正则表达式匹配文本',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: '需要匹配的文本',
            },
            pattern: {
              type: 'string',
              description: 'JavaScript 正则表达式，不包含两侧斜杠',
            },
            flags: {
              type: 'string',
              pattern: '^[dgimsuvy]*$',
              default: '',
              description: '可选的 JavaScript 正则标志，例如 gi',
            },
          },
          required: ['text', 'pattern'],
          additionalProperties: false,
        },
        outputSchema: {
          matches: 'array',
          groups: 'object',
        },
      },
      {
        type: 'calculator',
        name: '计算器',
        description: '计算数学表达式，支持加减乘除、取余、乘方',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: '数学表达式，例如 (123 + 456) * 2；乘方使用 ^',
            },
          },
          required: ['expression'],
          additionalProperties: false,
        },
        outputSchema: {
          expression: 'string',
          result: 'number',
        },
      },
      {
        type: 'code',
        name: '代码执行',
        description: '在安全沙箱中执行 JavaScript 代码',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: '需要执行的 JavaScript 代码',
            },
            language: {
              type: 'string',
              enum: ['javascript'],
              default: 'javascript',
              description: '代码语言，目前仅支持 javascript',
            },
          },
          required: ['code'],
          additionalProperties: false,
        },
        outputSchema: {
          result: 'any',
          logs: 'array',
        },
      },
    ];
  }
}
