#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { TrackerClient } from './client.js';
import { registerIssueTools } from './tools/issues.js';
import { registerCommentTools } from './tools/comments.js';
import { registerChecklistTools } from './tools/checklists.js';
import { registerWorklogTools } from './tools/worklog.js';
import { registerAttachmentTools } from './tools/attachments.js';
import { registerBulkTools } from './tools/bulk.js';
import { registerQueueTools } from './tools/queues.js';
import { registerBoardTools } from './tools/boards.js';
import { registerProjectTools } from './tools/projects.js';
import { registerEntityTools } from './tools/entities.js';
import { registerUserTools, registerAdminTools } from './tools/users.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new TrackerClient(config);

  const server = new McpServer({
    name: 'yandex-tracker',
    version: '0.1.0',
  });

  registerIssueTools(server, client);
  registerCommentTools(server, client);
  registerChecklistTools(server, client);
  registerWorklogTools(server, client);
  registerAttachmentTools(server, client);
  registerBulkTools(server, client);
  registerQueueTools(server, client);
  registerBoardTools(server, client);
  registerProjectTools(server, client);
  registerEntityTools(server, client);
  registerUserTools(server, client);
  registerAdminTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(`traker-mcp failed to start: ${message}\n`);
  process.exit(1);
});
