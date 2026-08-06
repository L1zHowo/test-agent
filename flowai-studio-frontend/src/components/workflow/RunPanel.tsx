import { useState } from 'react'
import { Button, Input, Empty } from 'antd'
import {
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import { useStore } from '../../store'
import './RunPanel.css'

const { TextArea } = Input

const AGENT_EVENT_LABELS: Record<string, string> = {
  agent_thinking: 'Agent 思考中',
  agent_tool_call: '调用工具',
  agent_tool_result: '工具返回',
  agent_final_answer: 'Agent 完成',
  agent_stopped: 'Agent 已停止',
  agent_error: 'Agent 异常',
  supervisor_thinking: 'Supervisor 思考中',
  worker_delegated: '已委派 Worker',
  worker_completed: 'Worker 完成',
  supervisor_final_answer: 'Supervisor 完成',
}

const getAgentEventText = (event: { type: string; data?: Record<string, unknown> }) => {
  const data = event.data || {}
  if (event.type === 'agent_tool_result') {
    return String(data.toolName || '工具') + '：' + JSON.stringify(data.result ?? data.error ?? '')
  }
  if (event.type === 'agent_tool_call') {
    return String(data.toolName || '工具') + '（' + (data.success === false ? '失败' : '已发起') + '）'
  }
  return String(data.message || data.output || data.task || '')
}

const RunPanel: React.FC = () => {
  const {
    currentWorkflow,
    nodes,
    executionStates,
    agentEvents,
    executionStatus,
    streamRunWorkflow,
    stopStreamWorkflow,
    setExecutionStatus,
    clearExecutionStates,
  } = useStore()

  const [inputsText, setInputsText] = useState('{"question": "你好，请介绍一下自己"}')
  const [isRunning, setIsRunning] = useState(false)

  const handleRun = async () => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) return

    let inputs: Record<string, any> = {}
    try {
      inputs = JSON.parse(inputsText)
    } catch {
      // Keep empty
    }

    setIsRunning(true)
    try {
      await streamRunWorkflow(workflowId, inputs)
    } catch {
      // Error handled in store
    } finally {
      setIsRunning(false)
    }
  }

  const handleStop = async () => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) return
    setIsRunning(false)
    await stopStreamWorkflow(workflowId)
  }

  const handleClear = () => {
    clearExecutionStates()
    setExecutionStatus(null)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined spin style={{ color: 'var(--c-blue)' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--c-green)' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: 'var(--c-red)' }} />
      case 'skipped':
        return <MinusCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
      default:
        return <ClockCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
    }
  }

  const executedNodes = Object.values(executionStates)
  const hasResults = executedNodes.length > 0

  return (
    <div className="run-panel">
      <div className="run-panel-header">
        <h3>调试运行</h3>
      </div>

      <div className="run-panel-body">
        {/* Input section */}
        <div className="run-section">
          <label className="run-section-label">输入参数 (JSON)</label>
          <TextArea
            value={inputsText}
            onChange={(e) => setInputsText(e.target.value)}
            placeholder='{"question": "你好"}'
            rows={4}
            className="run-input-textarea"
            disabled={isRunning}
          />
        </div>

        {/* Action buttons */}
        <div className="run-actions">
          {isRunning ? (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              block
              size="middle"
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              block
              size="middle"
            >
              运行工作流
            </Button>
          )}
          {hasResults && !isRunning && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="middle"
              className="run-clear-btn"
            >
              清除
            </Button>
          )}
        </div>

        {/* Execution status */}
        {executionStatus && (
          <div className={`run-status run-status--${executionStatus}`}>
            {statusIcon(executionStatus)}
            <span>
              {executionStatus === 'running'
                ? '运行中…'
                : executionStatus === 'success'
                ? '执行完成'
                : executionStatus === 'failed'
                ? '执行失败'
                : '已停止'}
            </span>
          </div>
        )}

        {agentEvents.length > 0 && (
          <div className="run-results">
            <label className="run-section-label">Agent 流式事件</label>
            {agentEvents.map((event, index) => (
              <div key={event.type + '-' + index} className="run-result-card">
                <strong>{AGENT_EVENT_LABELS[event.type] || event.type}</strong>
                <div>
                  {getAgentEventText(event)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Node results */}
        {hasResults ? (
          <div className="run-results">
            <label className="run-section-label">节点执行结果</label>
            {executedNodes.map((exec) => {
              const node = nodes.find((n) => n.id === exec.nodeId)
              return (
                <div key={exec.nodeId} className="run-result-card">
                  <div className="run-result-header">
                    {statusIcon(exec.status)}
                    <span className="run-result-name">
                      {(node?.data as any)?.label || exec.nodeId}
                    </span>
                    <span className="run-result-type">{node?.type}</span>
                  </div>
                  {(exec as any).output && (
                    <pre className="run-result-output">
                      {typeof (exec as any).output === 'string'
                        ? (exec as any).output
                        : JSON.stringify((exec as any).output, null, 2)}
                    </pre>
                  )}
                  {exec.error && (
                    <div className="run-result-error">{exec.error}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          !isRunning && (
            <div className="run-empty">
              <Empty
                description="点击「运行工作流」开始调试"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default RunPanel
