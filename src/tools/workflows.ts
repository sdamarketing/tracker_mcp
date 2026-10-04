import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { dangerTool, runTool } from '../utils.js';

const localized = z
  .union([z.string(), z.record(z.string(), z.string())])
  .describe('string or {"ru": "…", "en": "…"}');

const stepSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'Step object: {"status": "closed", "statusType": "DONE", "description": {"ru": "…"}, ' +
    '"actions": [transition objects {"id": "close", "name": …, "target": …, "screen": …}]}',
  );

export function registerWorkflowTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'create_workflow',
    {
      description:
        'Create a workflow (admin): statuses/steps plus transitions. Omit "queue" to create ' +
        'a common workflow available to all queues. Attach issue types via issueTypeResolutions.',
      inputSchema: z.object({
        name: z.string(),
        initialAction: z
          .record(z.string(), z.unknown())
          .describe('Initial transition: {"name": {"ru": "Открыть"}, "target": "open"}'),
        steps: z.array(stepSchema),
        id: z.string().optional().describe('Custom workflow id (auto "W…" if omitted)'),
        queue: z.string().optional().describe('Bind to one queue; omit for a common workflow'),
        type: z.string().optional().describe('"VISUAL"'),
        issueTypeResolutions: z
          .array(
            z.object({
              issueType: z.string().or(z.number()),
              resolutions: z.array(z.string().or(z.number())),
            }),
          )
          .optional()
          .describe('Allowed resolutions per issue type'),
      }),
    },
    async (args) => runTool(async () => client.post('/workflows', args)),
  );

  server.registerTool(
    'get_workflows',
    {
      description: 'List all workflows of the organization.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/workflows')),
  );

  server.registerTool(
    'get_queue_workflows',
    {
      description: 'Get workflows of a queue: map workflow id → bound issue types.',
      inputSchema: z.object({ queueId: z.string().or(z.number()) }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/queues/${encodeURIComponent(String(args.queueId))}/workflows`),
      ),
  );

  server.registerTool(
    'get_workflow',
    {
      description: 'Get one workflow by id.',
      inputSchema: z.object({ workflowId: z.string() }),
    },
    async (args) =>
      runTool(async () => client.get(`/workflows/${encodeURIComponent(args.workflowId)}`)),
  );

  server.registerTool(
    'update_workflow',
    {
      description:
        'Update a workflow (admin). Pass only the fields to change; version is required ' +
        'for optimistic locking (412 on conflict).',
      inputSchema: z.object({
        workflowId: z.string(),
        version: z.string().or(z.number()).describe('Current workflow version'),
        name: z.string().optional(),
        type: z.string().optional(),
        initialAction: z.record(z.string(), z.unknown()).optional(),
        steps: z.array(stepSchema).optional(),
        issueTypeResolutions: z
          .array(
            z.object({
              issueType: z.string().or(z.number()),
              resolutions: z.array(z.string().or(z.number())),
            }),
          )
          .optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { workflowId, version, ...body } = args;
        return client.patch(`/workflows/${encodeURIComponent(workflowId)}`, body, {
          version,
        });
      }),
  );

  server.registerTool(
    'update_workflow_action',
    {
      description:
        'Update one transition action of a workflow step (admin): name, target status, ' +
        'screen, conditions. Version is the current workflow version.',
      inputSchema: z.object({
        workflowId: z.string(),
        statusKey: z.string().describe('Step status key, e.g. "open"'),
        actionId: z.string().describe('Transition id, e.g. "close"'),
        version: z.string().or(z.number()).describe('Current workflow version'),
        name: localized.optional(),
        description: localized.optional(),
        target: z.string().or(z.number()).optional().describe('Target status'),
        screen: z.record(z.string(), z.unknown()).optional(),
        conditions: z.array(z.unknown()).optional(),
        functions: z.array(z.unknown()).optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { workflowId, statusKey, actionId, version, ...body } = args;
        return client.patch(
          `/workflows/${encodeURIComponent(workflowId)}/steps/${encodeURIComponent(statusKey)}` +
            `/actions/${encodeURIComponent(actionId)}`,
          body,
          { version },
        );
      }),
  );

  server.registerTool(
    'delete_workflow',
    {
      description: 'Delete a workflow by id (admin).',
      inputSchema: z.object({ confirm: z.boolean().optional().describe('Set to true to confirm this destructive/bulk operation'), workflowId: z.string() }),
    },
    async (args) =>
      dangerTool(args, async () =>
        client.delete(`/workflows/${encodeURIComponent(args.workflowId)}`),
      ),
  );
}
