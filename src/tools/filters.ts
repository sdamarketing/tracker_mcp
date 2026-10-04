import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { dangerTool, runTool } from '../utils.js';

const filterBody = {
  name: z.string().optional().describe('Filter name'),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Conditions by field, e.g. {"queue": "TREK", "status": "open"} (replaces fully)'),
  query: z
    .string()
    .optional()
    .describe('Query language condition (mutually exclusive with filter)'),
  fields: z.array(z.string()).optional().describe('Issue fields shown as columns'),
  sorts: z
    .array(z.object({ field: z.string(), isAscending: z.boolean() }))
    .optional()
    .describe('Sort order'),
  groupBy: z.string().optional().describe('Grouping field'),
  folder: z.string().optional().describe('Folder id to place the filter into'),
};

export function registerFilterTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'create_filter',
    {
      description: 'Create a saved filter for issue lists.',
      inputSchema: z.object({
        ...filterBody,
        name: z.string().describe('Filter name'),
      }),
    },
    async (args) => runTool(async () => client.post('/filters', args)),
  );

  server.registerTool(
    'get_filter',
    {
      description: 'Get saved filter parameters by id.',
      inputSchema: z.object({ filterId: z.number() }),
    },
    async (args) =>
      runTool(async () => client.get(`/filters/${encodeURIComponent(args.filterId)}`)),
  );

  server.registerTool(
    'update_filter',
    {
      description:
        'Update a saved filter. "filter"/"query" fully replace the previous conditions.',
      inputSchema: z.object({
        filterId: z.number(),
        ...filterBody,
      }),
    },
    async (args) =>
      runTool(async () => {
        const { filterId, ...body } = args;
        return client.patch(`/filters/${encodeURIComponent(filterId)}`, body);
      }),
  );

  server.registerTool(
    'delete_filter',
    {
      description: 'Delete a saved filter (uses the v2 API path per official docs).',
      inputSchema: z.object({ confirm: z.boolean().optional().describe('Set to true to confirm this destructive/bulk operation'), filterId: z.number() }),
    },
    async (args) =>
      dangerTool(args, async () =>
        client.delete(`/v2/filters/${encodeURIComponent(args.filterId)}`),
      ),
  );
}
