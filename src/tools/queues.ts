import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerQueueTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_queues',
    {
      description: 'List queues of the organization.',
      inputSchema: z.object({
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) => runTool(async () => client.get('/queues', args)),
  );

  server.registerTool(
    'get_queue',
    {
      description: 'Get queue parameters by key or id.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key (case-sensitive) or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}`)),
  );

  server.registerTool(
    'create_queue',
    {
      description:
        'Create a new queue. Requires key, name, lead, default type/priority and an ' +
        'issueTypesConfig array binding issue types to workflow templates.',
      inputSchema: z.object({
        key: z.string().describe('Unique queue key in latin letters, e.g. "DESIGN"'),
        name: z.string().describe('Queue name'),
        lead: z.string().describe('Queue owner login or user id'),
        defaultType: z.string().describe('Default issue type key, e.g. "task"'),
        defaultPriority: z.string().describe('Default issue priority key, e.g. "normal"'),
        issueTypesConfig: z
          .array(
            z.object({
              issueType: z.string().describe('Issue type key, e.g. "task", "bug"'),
              workflow: z
                .string()
                .describe(
                  'Workflow template id, e.g. "developmentPresetWorkflow", ' +
                  '"scrumDevelopmentPresetWorkflow", "basicSupportPresetWorkflow", ' +
                  '"kanbanDevelopmentPresetWorkflow"',
                ),
              resolutions: z
                .array(z.string())
                .optional()
                .describe('Allowed resolution keys, e.g. ["fixed", "wontFix"]'),
            }),
          )
          .describe('Issue type configs of the queue'),
      }),
    },
    async (args) => runTool(async () => client.post('/queues', args)),
  );

  server.registerTool(
    'get_queue_fields',
    {
      description:
        'Get fields available/required for issues of the queue (includes required flags ' +
        'and allowed values) — useful before creating an issue in this queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/fields`)),
  );

  server.registerTool(
    'get_queue_versions',
    {
      description: 'List versions of a queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/versions`)),
  );

  server.registerTool(
    'create_queue_version',
    {
      description: 'Create a version in a queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
        name: z.string().describe('Version name'),
        description: z.string().optional().describe('Version description'),
        startDate: z.string().optional().describe('Start date, format YYYY-MM-DD'),
        releaseDate: z.string().optional().describe('Release date, format YYYY-MM-DD'),
        status: z.string().optional().describe('Version status: "open" or "released"'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, ...body } = args;
        return client.post(`/queues/${encodeURIComponent(queueId)}/versions`, body);
      }),
  );

  server.registerTool(
    'create_component',
    {
      description: 'Create a component in a queue.',
      inputSchema: z.object({
        name: z.string().describe('Component name'),
        queue: z.string().describe('Queue key'),
        description: z.string().optional().describe('Component description'),
        lead: z.string().optional().describe('Component owner login'),
        assignAuto: z
          .boolean()
          .optional()
          .describe('Assign the component owner as default assignee'),
      }),
    },
    async (args) => runTool(async () => client.post('/components', args)),
  );

  server.registerTool(
    'get_queue_components',
    {
      description: 'List components of a queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/components`)),
  );

  server.registerTool(
    'get_queue_local_fields',
    {
      description:
        'List local (queue-specific) issue fields of a queue. Field ids look like ' +
        '"<queue id>--<field key>" and can be used in create/edit issue requests.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/localFields`)),
  );

  server.registerTool(
    'get_queue_macroses',
    {
      description:
        'List macroes of a queue (saved bundles of field updates + comment text).',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/macros`)),
  );

  server.registerTool(
    'get_queue_tags',
    {
      description: 'List tags used in a queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/tags`)),
  );

  server.registerTool(
    'get_queue_triggers',
    {
      description: 'List triggers configured in a queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/triggers`)),
  );

  server.registerTool(
    'get_queue_autoactions',
    {
      description: 'List autoactions configured in a queue.',
      inputSchema: z.object({
        queueId: z.string().describe('Queue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/queues/${encodeURIComponent(args.queueId)}/autoactions`)),
  );
}
