import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { dangerTool, runTool } from '../utils.js';

const issuesSchema = z
  .union([z.array(z.string()), z.string()])
  .describe(
    'List of issue keys/ids OR a Tracker query-language filter string, ' +
    'e.g. "Queue: TREK Assignee: user1" (max 10000 issues per operation)',
  );

export function registerBulkTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'bulk_update_issues',
    {
      description:
        'Bulk edit many issues at once (max 10000). Values use the issue edit format; ' +
        'array fields support add/set/replace commands, e.g. {"tags": {"add": ["x"]}}.',
      inputSchema: z.object({
        confirm: z.boolean().optional().describe('Set to true to confirm this destructive/bulk operation'),
        issues: issuesSchema,
        values: z
          .record(z.string(), z.unknown())
          .describe('Fields to set, e.g. {"priority": "blocker", "comment": "bulk update"}'),
        notify: z.boolean().optional().describe('Notify users about the change (default false)'),
      }),
    },
    async (args) =>
      dangerTool(args, async () => {
        const { issues, values, notify } = args;
        return client.post('/bulkchange/_update', { issues, values }, notify !== undefined
          ? { notify }
          : undefined);
      }),
  );

  server.registerTool(
    'bulk_move_issues',
    {
      description:
        'Bulk move issues to another queue. Components, versions and projects are cleared by default.',
      inputSchema: z.object({
        confirm: z.boolean().optional().describe('Set to true to confirm this destructive/bulk operation'),
        issues: issuesSchema,
        queue: z.string().describe('Target queue key'),
        notify: z.boolean().optional().describe('Notify users about the change (default false)'),
      }),
    },
    async (args) =>
      dangerTool(args, async () => {
        const { issues, queue, notify } = args;
        return client.post('/bulkchange/_move', { issues, queue }, notify !== undefined
          ? { notify }
          : undefined);
      }),
  );

  server.registerTool(
    'bulk_transition_issues',
    {
      description:
        'Bulk move issues to a new status via a workflow transition. Get available transition ' +
        'ids via get_issue_transitions. Statuses like "closed" may require a resolution in values.',
      inputSchema: z.object({
        confirm: z.boolean().optional().describe('Set to true to confirm this destructive/bulk operation'),
        issues: issuesSchema,
        transition: z.string().describe('Transition id, e.g. "close", "start_progress"'),
        values: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Fields to set with the transition, e.g. {"resolution": "fixed"}'),
        notify: z.boolean().optional().describe('Notify users about the change (default false)'),
      }),
    },
    async (args) =>
      dangerTool(args, async () => {
        const { issues, transition, values, notify } = args;
        const body: Record<string, unknown> = { issues, transition };
        if (values) body.values = values;
        return client.post('/bulkchange/_transition', body, notify !== undefined
          ? { notify }
          : undefined);
      }),
  );

  server.registerTool(
    'get_bulk_operation_info',
    {
      description: 'Get status and progress of a bulk change operation by its id.',
      inputSchema: z.object({
        bulkOperationId: z.string().describe('Bulk operation id returned by bulk_* tools'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/bulkchange/${encodeURIComponent(args.bulkOperationId)}`),
      ),
  );
}
