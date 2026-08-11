# ============================================================
# FlowAI Studio Frontend - Multi-stage Docker Build
# ============================================================
# Stage 1: Builder - npm install + Vite build
# Stage 2: Nginx 静态资源服务
#
# 竞品对标:
# - Dify: Nginx 多阶段构建
# - Coze: CDN + Nginx
# - n8n: 不分离前后端
# ============================================================

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 workspace 清单（利用 Docker 缓存层）
COPY package.json package-lock.json ./
COPY flowai-studio-backend/package.json ./flowai-studio-backend/package.json
COPY flowai-studio-frontend/package.json ./flowai-studio-frontend/package.json
COPY packages/shared-contracts/package.json ./packages/shared-contracts/package.json

# 只安装前端及其 workspace 依赖
RUN npm ci --workspace=flowai-studio-frontend --include-workspace-root

# 复制源代码
COPY flowai-studio-frontend/ ./flowai-studio-frontend/
COPY packages/shared-contracts/ ./packages/shared-contracts/

WORKDIR /app/flowai-studio-frontend

# 构建生产版本
RUN npm run build

# Stage 2: Nginx
FROM nginx:alpine AS runner

# 复制自定义 Nginx 配置
COPY flowai-studio-frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 从 builder 复制构建产物
COPY --from=builder /app/flowai-studio-frontend/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
