# FlowAI Studio

FlowAI Studio 是一个可视化 AI 应用与工作流编排平台，包含前端画布、后端执行器、RAG 知识库、Agent、工具、MCP 和团队协作能力，适合搭建带有大模型、知识检索与工具调用的 AI 应用。

> 当前仓库更适合作为开发和学习项目。运行时需要 Qwen 模型服务、PostgreSQL + pgvector 和 Redis；生产部署前还需要补充安全、运维和端到端测试。

## 已实现能力

### 应用与工作流

- 创建、编辑、发布、取消发布、归档和恢复应用。
- 使用 React Flow 拖拽编排工作流。
- 支持开始、用户输入、LLM、Agent、RAG、工具、条件分支和输出节点。
- 支持普通执行和 SSE 流式执行。
- 执行器包含超时、重试、心跳、取消运行和错误处理。
- 支持工作流版本比较与回滚、DSL 导入导出与校验、工作流模板。

### 大模型与 Agent

- LLM 统一使用通义千问 Qwen。
- 可查询 Qwen 模型和服务健康状态，并估算 Token 成本。
- Agent 支持单 Agent ReAct 和 Supervisor/Worker 多智能体模式。
- Agent 可以组合知识库和工具完成任务。
- 调试中心提供流式对话、会话历史和可选的 RAG 上下文。

调试中心、LLM 节点和 Agent 都使用 Qwen，需要配置有效的 `QWEN_API_KEY`。

### RAG 知识库

- 按用户创建和管理知识库。
- 支持 `txt`、`md`、`json`、`csv`、`log`、`yaml`、`pdf` 和 `docx`。
- 文档会进行解析、分块、Embedding 和向量写入。
- 支持向量、关键词和混合检索，混合检索使用 RRF 融合。
- Embedding 固定使用 Qwen `text-embedding-v3`。
- 向量存储固定使用 PostgreSQL 的 pgvector 扩展。
- 使用内存与 Redis 两级缓存。

Prisma Schema 的向量列固定为 `vector(1024)`，与 Qwen `text-embedding-v3` 的当前配置一致。

### 工具、MCP 与协作

- 内置时间、HTTP、JSON、正则、计算器和 JavaScript 沙箱工具。
- 支持创建自定义 HTTP 工具。
- 支持通过 stdio + JSON-RPC 2.0 管理和调用 MCP Server。
- 支持注册登录、JWT、数据按用户隔离、角色和团队权限。
- 支持团队、成员、团队应用、公开分享、嵌入配置和 API Key。
- 支持 Token/费用统计、工作流执行记录和健康检查。

MCP Server 由后端作为子进程运行。使用 Docker 时，对应命令和依赖也必须存在于后端容器中。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、Ant Design、React Flow、Zustand |
| 后端 | NestJS、TypeScript、Prisma、JWT、class-validator、SSE |
| 数据库 | PostgreSQL 16 + pgvector |
| 缓存 | Redis 7 |
| 文档处理 | pdf-parse、mammoth |
| 部署 | Docker Compose、Nginx |

仓库有两个独立 Node.js 工程，但没有根级 Workspace 配置，因此是同仓库多项目结构，不是 npm/pnpm Workspace 意义上的 Monorepo。

## 项目结构

```text
.
|-- docker-compose.yml
|-- scripts/init-pgvector.sql
|-- flowai-studio-backend/
|   |-- prisma/              # Schema、迁移和 Seed
|   `-- src/                 # User、App、Workflow、Agent、RAG、Skill、MCP、Team
`-- flowai-studio-frontend/
    `-- src/                 # 页面、组件、路由、状态和 API 封装
```

## 环境要求

- Node.js 20 推荐，至少 Node.js 18。
- npm 9 或更高版本。
- PostgreSQL，并启用 pgvector。
- Redis。
- 至少一个可用的大模型和 Embedding 服务。

## 后端环境变量

仓库当前没有 `.env.example`。请配置 `flowai-studio-backend/.env`：

```dotenv
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowai_studio?schema=public
REDIS_URL=redis://localhost:6379

JWT_SECRET=请替换为足够长且随机的字符串
JWT_EXPIRES_IN=7d

QWEN_API_KEY=你的通义千问_API_Key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_EMBEDDING_API_KEY=你的通义千问_API_Key
QWEN_EMBEDDING_MODEL=text-embedding-v3
QWEN_EMBEDDING_DIMENSION=1024

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

不要提交真实的 `.env`、JWT Secret 或 API Key。根目录 `.gitignore` 已忽略所有 `.env` 文件。


## 本地开发启动

推荐用 Docker 运行 PostgreSQL 和 Redis，在本机运行前后端。

### 1. 启动 PostgreSQL 与 Redis

```powershell
docker compose up -d postgres redis
```

首次创建数据库时会执行 `scripts/init-pgvector.sql`。如果旧数据库卷中没有扩展：

```powershell
docker exec -it flowai-postgres psql -U postgres -d flowai_studio -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. 初始化并启动后端

```powershell
cd flowai-studio-backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run start:dev
```

后端：`http://localhost:3000`
健康检查：`http://localhost:3000/api/health`

PowerShell 阻止 `npm.ps1` 时，在命令前加 `cmd /c`：

```powershell
cmd /c npx prisma db push
cmd /c npx prisma db seed
cmd /c npm run start:dev
```

### 3. 启动前端

```powershell
cd flowai-studio-frontend
npm install
npm run dev
```

浏览器访问：`http://localhost:5173`

## Docker 完整启动

先在项目根目录创建 `.env`：

```dotenv
POSTGRES_PASSWORD=请修改数据库密码
JWT_SECRET=请替换为足够长且随机的字符串
QWEN_API_KEY=你的通义千问_API_Key
QWEN_EMBEDDING_API_KEY=你的通义千问_API_Key
```

首次启动：

```powershell
docker compose up -d postgres redis
docker compose build backend frontend
docker compose run --rm backend npx prisma db push
docker compose run --rm backend npx prisma db seed
docker compose up -d
```

- 前端：`http://localhost`
- 后端：`http://localhost:3000`

Compose 当前不会自动执行 Prisma 初始化，新数据库必须先运行 `db push` 和 `db seed`。

## 默认演示数据

执行 Seed 后会创建：

- 账号：`admin`
- 密码：`admin123`
- 知识库：`Default Knowledge Base`
- 文档：`FlowAI Studio Introduction.md`
- 默认 RAG 演示应用和工作流

默认密码仅供本地演示，部署到可访问的网络前必须修改。

## 测试与构建

```powershell
cd flowai-studio-backend
npm test
npm run build
```

```powershell
cd flowai-studio-frontend
npm run build
npm run lint
```

## 当前限制

- LLM 和 Embedding 都只使用 Qwen。
- pgvector 的 Prisma 向量字段固定为 1024 维。
- 向量存储只支持 pgvector，并与主 PostgreSQL 数据库共用同一套服务。
- MCP 在容器中需要额外安装对应命令。
- 自定义 HTTP 和代码工具权限较高，生产环境应增加网络控制、审计和更严格的沙箱。