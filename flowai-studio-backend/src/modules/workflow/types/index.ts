import { Subject } from 'rxjs'

export interface NodeExecutionOptions {
  sseSubject?: Subject<any>;
  signal?: AbortSignal;
}

export interface INodeExecutor {
  execute(
    node: any,
    context: Record<string, any>,
    options?: NodeExecutionOptions,
  ): Promise<Record<string, any>>;
}
