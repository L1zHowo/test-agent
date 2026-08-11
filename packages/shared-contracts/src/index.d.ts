export type NodeType =
  | 'start'
  | 'userInput'
  | 'llm'
  | 'rag'
  | 'skill'
  | 'condition'
  | 'output'
  | 'agent'

export type JSONPrimitive = string | number | boolean | null
export type JSONValue = JSONPrimitive | JSONObject | JSONValue[]
export interface JSONObject {
  [key: string]: JSONValue
}

export interface BaseNodeData {
  label: string
  description?: string
  [key: string]: unknown
}

export interface StartNodeData extends BaseNodeData {
  variables: { key: string; value: JSONValue }[]
}

export interface UserInputNodeData extends BaseNodeData {
  inputField: string
}

export interface LLMNodeData extends BaseNodeData {
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
}

export interface RAGNodeData extends BaseNodeData {
  knowledgeBaseId: string
  query: string
  topK: number
  similarityThreshold: number
}

export interface SkillNodeData extends BaseNodeData {
  skillId: string
  skillType: 'builtin' | 'custom'
  parameters: JSONObject
}

export interface ConditionNodeData extends BaseNodeData {
  conditions: { variable: string; operator: string; value: JSONValue }[]
}

export interface OutputNodeData extends BaseNodeData {
  outputValue: JSONValue
}

export type AgentMode = 'single' | 'supervisor'
export type AgentStrategy = 'react' | 'plan-and-execute' | 'reflection'

export interface WorkerConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  toolIds: string[]
  knowledgeBaseIds: string[]
  ragEnabled: boolean
}

export interface AgentNodeData extends BaseNodeData {
  agentMode: AgentMode
  strategy: AgentStrategy
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
  maxIterations: number
  toolIds: string[]
  knowledgeBaseIds: string[]
  ragEnabled: boolean
  memoryEnabled: boolean
  memoryWindowSize: number
  supervisorPrompt?: string
  supervisorModel?: string
  workers?: WorkerConfig[]
}

export type WorkflowNodeData =
  | StartNodeData
  | UserInputNodeData
  | LLMNodeData
  | RAGNodeData
  | SkillNodeData
  | ConditionNodeData
  | OutputNodeData
  | AgentNodeData

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
  sourceHandle?: string | null
  targetHandle?: string | null
}
