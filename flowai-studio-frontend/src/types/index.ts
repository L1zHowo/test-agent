// 用户相关类型
export interface User {
  id: string
  username: string
  avatar?: string
  createdAt: string
}

export interface LoginForm {
  username: string
  password: string
}

export interface RegisterForm {
  username: string
  password: string
}

// 应用相关类型
export interface Application {
  id: string
  name: string
  description?: string
  icon?: string
  status: 'draft' | 'published' | 'archived'
  shareLink?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAppForm {
  name: string
  description?: string
  icon?: string
}

// 工作流相关类型
import type { WorkflowEdge, WorkflowNode } from '@flowai/shared-contracts'

export type {
  AgentMode,
  AgentNodeData,
  AgentStrategy,
  BaseNodeData,
  ConditionNodeData,
  JSONObject,
  JSONPrimitive,
  JSONValue,
  LLMNodeData,
  NodeType,
  OutputNodeData,
  RAGNodeData,
  SkillNodeData,
  StartNodeData,
  UserInputNodeData,
  WorkerConfig,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from '@flowai/shared-contracts'

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// 知识库相关类型

/** Embedding Provider 类型 */
export type EmbeddingProviderType = 'qwen'

/** 向量存储后端类型 */
export type VectorStoreType = 'pgvector'

/** Qwen Embedding 模型 */
export const EMBEDDING_MODELS: Record<EmbeddingProviderType, { label: string; value: string; dimension: number }[]> = {
  qwen: [
    { label: 'text-embedding-v3 (1024维)', value: 'text-embedding-v3', dimension: 1024 },
  ],
}


export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  type?: string
  embeddingProvider: EmbeddingProviderType
  embeddingModel: string
  embeddingDimension: number
  vectorStore: VectorStoreType
  chunkSize: number
  chunkOverlap: number
  topK: number
  similarityThreshold: number
  retrievalMode: 'vector' | 'keyword' | 'hybrid'
  vectorWeight: number
  rrfK: number
  userId: string
  createdAt: string
  updatedAt: string
  documents?: Document[]
}

/** 检索模式选项 */
export const RETRIEVAL_MODE_OPTIONS: { label: string; value: KnowledgeBase['retrievalMode']; description: string; color: string }[] = [
  { label: '向量检索', value: 'vector', description: '语义匹配，适合同义词、语义关联场景', color: '#1677ff' },
  { label: '关键词检索', value: 'keyword', description: 'BM25 精确匹配，适合专有名词、编号场景', color: '#52c41a' },
  { label: '混合检索', value: 'hybrid', description: '向量+关键词 RRF 融合，推荐生产使用', color: '#722ed1' },
]

export interface Document {
  id: string
  name: string
  size: number
  filePath?: string
  knowledgeBaseId: string
  createdAt: string
  updatedAt: string
}

export interface DocumentChunk {
  id: string
  content: string
  chunkIndex: number
  startIndex: number
  endIndex: number
  metadata?: string
  createdAt: string
}

export interface DocumentChunksResponse {
  documentId: string
  documentName: string
  totalChunks: number
  chunks: DocumentChunk[]
}

// Skill工具相关类型
export interface Skill {
  id: string
  name: string
  description?: string
  type: 'builtin' | 'custom'
  builtinType?: string
  config?: Record<string, unknown>
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 节点执行状态
export interface AgentStreamEvent {
  type: string
  data?: Record<string, unknown>
}

export type WorkflowExecutionStatus = 'running' | 'success' | 'failed' | 'stopped'

export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'failed'

export interface NodeExecution {
  nodeId: string
  status: NodeExecutionStatus
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  error?: string
  startedAt?: string
  completedAt?: string
}

// ============================================================
// 团队与权限 (Phase 5 - RBAC)
// ============================================================

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type TeamAppPermission = 'full_access' | 'can_edit' | 'can_view'
export type GlobalRole = 'admin' | 'member'
export type ApiKeyScope = 'app:read' | 'app:write' | 'app:execute' | 'workflow:read' | 'workflow:write' | 'knowledge:read' | 'knowledge:write'

export interface Team {
  id: string
  name: string
  description?: string
  avatar?: string
  ownerId: string
  createdAt: string
  updatedAt: string
  memberCount?: number
  members?: TeamMember[]
  applications?: TeamApplication[]
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: string
  user?: User
}

export interface TeamApplication {
  id: string
  teamId: string
  applicationId: string
  permission: TeamAppPermission
  addedAt: string
  application?: any
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  isActive: boolean
  lastUsedAt?: string
  expiresAt?: string
  createdAt: string
}

export interface ApiKeyCreatedResponse {
  id: string
  name: string
  key: string
  keyPrefix: string
  createdAt: string
}

export interface AppShare {
  id: string
  applicationId: string
  shareLink: string
  isPublic: boolean
  accessCount: number
  embedConfig?: EmbedConfig
  createdAt: string
}

export interface EmbedConfig {
  enabled: boolean
  width?: string
  height?: string
  theme?: 'light' | 'dark' | 'auto'
  showHeader?: boolean
}

// 表单类型
export interface CreateTeamForm {
  name: string
  description?: string
}

export interface AddMemberForm {
  userId: string
  role: TeamRole
}

export interface AddTeamAppForm {
  applicationId: string
  permission: TeamAppPermission
}

export interface CreateApiKeyForm {
  name: string
  scopes: ApiKeyScope[]
  expiresAt?: string
}

export interface UpdateShareSettingsForm {
  isPublic?: boolean
  embedConfig?: EmbedConfig
}

// 常量
export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: '所有者',
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者',
}

export const TEAM_APP_PERMISSION_LABELS: Record<TeamAppPermission, string> = {
  full_access: '完全访问',
  can_edit: '可编辑',
  can_view: '仅查看',
}

export const API_KEY_SCOPE_OPTIONS: { label: string; value: ApiKeyScope }[] = [
  { label: '应用读取', value: 'app:read' },
  { label: '应用写入', value: 'app:write' },
  { label: '应用执行', value: 'app:execute' },
  { label: '工作流读取', value: 'workflow:read' },
  { label: '工作流写入', value: 'workflow:write' },
  { label: '知识库读取', value: 'knowledge:read' },
  { label: '知识库写入', value: 'knowledge:write' },
]

// 补充类型
export interface UpdateTeamForm {
  name?: string
  description?: string
}

export interface UpdateMemberRoleForm {
  role: TeamRole
}

export interface UpdateTeamAppPermissionForm {
  permission: TeamAppPermission
}

export interface EmbedCodeResponse {
  iframeCode: string
  scriptCode: string
}
