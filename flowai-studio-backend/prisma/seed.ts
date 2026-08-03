import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

async function main() {
  console.log('Start seeding ...');

  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
  console.log('pgvector extension enabled');

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashedPassword, globalRole: 'admin' },
    create: {
      username: 'admin',
      password: hashedPassword,
      globalRole: 'admin',
    },
  });
  console.log(`Created or updated user: ${adminUser.username}`);

  const kbName = 'Default Knowledge Base';
  const defaultKb = await prisma.knowledgeBase.upsert({
    where: { name_userId: { name: kbName, userId: adminUser.id } },
    update: {},
    create: {
      name: kbName,
      description: 'Default knowledge base for FlowAI Studio demo.',
      embeddingProvider: 'qwen',
      embeddingModel: 'text-embedding-v3',
      embeddingDimension: 1024,
      vectorStore: 'pgvector',
      chunkSize: 500,
      chunkOverlap: 50,
      retrievalMode: 'vector',
      userId: adminUser.id,
    },
  });
  console.log(`Created or found knowledge base: ${defaultKb.name}`);

  const docContent = `
FlowAI Studio is a full-stack visual low-code orchestration platform for AI applications.
It helps users build, test, and publish AI workflows with a visual editor.
Core features include visual workflow editing, RAG knowledge base management, MCP tool integration, NestJS backend APIs, PostgreSQL with pgvector, Redis caching, and React/Vite frontend pages.
The default demo can be used to verify knowledge base retrieval and workflow execution.
  `.trim();
  const docName = 'FlowAI Studio Introduction.md';

  const document = await prisma.document.upsert({
    where: { name_knowledgeBaseId: { name: docName, knowledgeBaseId: defaultKb.id } },
    update: {
      content: docContent,
      size: Buffer.from(docContent).length,
    },
    create: {
      name: docName,
      content: docContent,
      knowledgeBaseId: defaultKb.id,
      size: Buffer.from(docContent).length,
      mimeType: 'text/markdown',
      status: 'completed',
    },
  });

  await prisma.documentChunk.deleteMany({
    where: { documentId: document.id },
  });

  const chunkSize = 500;
  const overlap = 50;
  const chunks: string[] = [];
  let start = 0;
  while (start < docContent.length) {
    const end = Math.min(start + chunkSize, docContent.length);
    chunks.push(docContent.substring(start, end));
    start += chunkSize - overlap;
  }

  for (let i = 0; i < chunks.length; i++) {
    const zeroVector = Array(1024).fill(0).join(',');
    const vectorStr = `[${zeroVector}]`;
    const content = escapeSql(chunks[i]);

    await prisma.$executeRawUnsafe(`
      INSERT INTO document_chunks (id, content, embedding, "chunkIndex", "startIndex", "endIndex", "documentId", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        '${content}',
        '${vectorStr}'::vector,
        ${i},
        0,
        ${chunks[i].length},
        '${document.id}',
        NOW()
      )
    `);
  }
  console.log(`Created ${chunks.length} chunks for default document`);

  const demoAppName = 'Default RAG Demo Application';
  let demoApp = await prisma.application.findFirst({
    where: { name: demoAppName, userId: adminUser.id },
  });

  if (!demoApp) {
    demoApp = await prisma.application.create({
      data: {
        name: demoAppName,
        description: 'Built-in demo application for the default RAG workflow.',
        status: 'published',
        userId: adminUser.id,
      },
    });
  } else {
    demoApp = await prisma.application.update({
      where: { id: demoApp.id },
      data: {
        description: 'Built-in demo application for the default RAG workflow.',
        status: 'published',
      },
    });
  }
  console.log(`Created or updated demo application: ${demoApp.name}`);

  const demoWorkflowName = 'Default RAG Workflow';
  const demoNodes = [
    {
      id: 'start_demo',
      type: 'start',
      position: { x: 80, y: 180 },
      data: {
        label: 'Start',
        variables: [{ key: 'question', value: 'What are the core features of FlowAI Studio?' }],
      },
    },
    {
      id: 'rag_demo',
      type: 'rag',
      position: { x: 340, y: 180 },
      data: {
        label: 'RAG Retrieve',
        knowledgeBaseId: defaultKb.id,
        query: '{{question}}',
        topK: 3,
        similarityThreshold: 0.7,
      },
    },
    {
      id: 'output_demo',
      type: 'output',
      position: { x: 620, y: 180 },
      data: {
        label: 'Output',
        outputValue: '{{rag_demo.documents}}',
      },
    },
  ];
  const demoEdges = [
    { id: 'edge_start_rag', source: 'start_demo', target: 'rag_demo' },
    { id: 'edge_rag_output', source: 'rag_demo', target: 'output_demo' },
  ];

  const existingWorkflow = await prisma.workflow.findFirst({
    where: { name: demoWorkflowName, applicationId: demoApp.id },
  });

  if (!existingWorkflow) {
    await prisma.workflow.create({
      data: {
        name: demoWorkflowName,
        description: 'Built-in demo workflow: Start -> RAG Retrieve -> Output.',
        applicationId: demoApp.id,
        nodes: JSON.stringify(demoNodes),
        edges: JSON.stringify(demoEdges),
      },
    });
  } else {
    await prisma.workflow.update({
      where: { id: existingWorkflow.id },
      data: {
        description: 'Built-in demo workflow: Start -> RAG Retrieve -> Output.',
        nodes: JSON.stringify(demoNodes),
        edges: JSON.stringify(demoEdges),
      },
    });
  }
  console.log(`Created or updated demo workflow: ${demoWorkflowName}`);
  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
