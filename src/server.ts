import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { loadConfig, type TrackerConfig } from './config.js';
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
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

export interface BuiltServer {
  server: McpServer;
  client: TrackerClient;
  registered: number;
  skipped: number;
  readOnly: boolean;
}

/**
 * Build the full yandex-tracker MCP server: config + client + all tools.
 * Shared by the stdio entry (src/index.ts) and the HTTP entry (src/serve.ts).
 * `TRACKER_READ_ONLY=1` hides every non-read tool (annotations are attached
 * to all tools either way).
 */
export function buildServer(config?: TrackerConfig): BuiltServer {
  const cfg = config ?? loadConfig();
  const client = new TrackerClient(cfg);

  const server = new McpServer({
    name: 'yandex-tracker',
    // Версия берётся из package.json (читаем файл рядом с dist)
    version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
      .version as string,
  });

  const readOnly = /^(1|true|yes)$/i.test(process.env.TRACKER_READ_ONLY ?? '');
  const isRead = (name: string): boolean =>
    /^(get_|list_|find_|search_|count_|download_)/.test(name) || name === 'get_current_user';

  // Attach tool annotations (readOnly/destructive hints); TRACKER_READ_ONLY=1 serves reads only.
  const originalRegister = server.registerTool.bind(server);
  let registered = 0;
  let skipped = 0;
  server.registerTool = ((name: string, cfgTool: Record<string, unknown>, cb: unknown) => {
    const annotations = isRead(name)
      ? { readOnlyHint: true }
      : { readOnlyHint: false, destructiveHint: name.startsWith('delete_') };
    if (readOnly && !annotations.readOnlyHint) {
      skipped++;
      return undefined as never;
    }
    registered++;
    return originalRegister(name, { ...cfgTool, annotations }, cb as never);
  }) as typeof server.registerTool;

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
  registerResources(server, client);
  registerPrompts(server);

  process.stderr.write(
    `yandex-tracker: ${registered} tools registered${readOnly ? ` (read-only mode, ${skipped} write tools hidden)` : ''}\n`,
  );

  return { server, client, registered, skipped, readOnly };
}
