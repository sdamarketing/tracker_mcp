#!/usr/bin/env node

import { readFileSync } from 'node:fs';
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
import { registerDashboardTools } from './tools/dashboards.js';
import { registerProjectTools } from './tools/projects.js';
import { registerEntityTools } from './tools/entities.js';
import { registerUserTools, registerAdminTools } from './tools/users.js';
import { registerFieldTools } from './tools/fields.js';
import { registerExternalLinkTools } from './tools/externals.js';
import { registerFilterTools } from './tools/filters.js';
import { registerReportTools } from './tools/reports.js';
import { registerWorkflowTools } from './tools/workflows.js';
import { registerGapTools } from './tools/gaps.js';
import { registerImportTools } from './tools/import.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new TrackerClient(config);

  const server = new McpServer({
    name: 'yandex-tracker',
    // Версия берётся из package.json (genversion не нужен — читаем файл рядом с dist)
    version: JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ).version as string,
  });

  registerIssueTools(server, client);
  registerCommentTools(server, client);
  registerChecklistTools(server, client);
  registerWorklogTools(server, client);
  registerAttachmentTools(server, client);
  registerBulkTools(server, client);
  registerQueueTools(server, client);
  registerBoardTools(server, client);
  registerDashboardTools(server, client);
  registerProjectTools(server, client);
  registerEntityTools(server, client);
  registerUserTools(server, client);
  registerAdminTools(server, client);
  registerFieldTools(server, client);
  registerExternalLinkTools(server, client);
  registerFilterTools(server, client);
  registerReportTools(server, client);
  registerWorkflowTools(server, client);
  registerGapTools(server, client);
  registerImportTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(`traker-mcp failed to start: ${message}\n`);
  process.exit(1);
});
