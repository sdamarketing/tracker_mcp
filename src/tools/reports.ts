import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerReportTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'create_issue_report',
    {
      description:
        'Create a saved issue-list report (used by dashboard "issue list" widgets). ' +
        'Pick exactly one issue source inside parameters.filter: query | filter | filterId.',
      inputSchema: z.object({
        summary: z.string().describe('Report name'),
        format: z
          .enum(['xlsx', 'xml', 'csv'])
          .optional()
          .describe('Export format, default xlsx'),
        query: z.string().optional().describe('Query language source'),
        filter: z.record(z.string(), z.unknown()).optional().describe('Field-value source'),
        filterId: z.number().optional().describe('Saved filter id as source'),
        sorts: z
          .array(z.object({ orderBy: z.string(), orderAsc: z.boolean().optional() }))
          .optional(),
        fields: z.array(z.string()).optional().describe('Issue fields to include in export'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { summary, format, ...source } = args;
        const filter: Record<string, unknown> = {};
        if (source.query !== undefined) filter.query = source.query;
        if (source.filter !== undefined) filter.filter = source.filter;
        if (source.filterId !== undefined) filter.filterId = source.filterId;
        if (source.sorts !== undefined) filter.sorts = source.sorts;
        const body = {
          fields: {
            summary,
            parameters: {
              type: 'issueFilterExport',
              ...(format !== undefined ? { format } : {}),
              filter,
              ...(source.fields !== undefined ? { fields: source.fields } : {}),
            },
          },
        };
        return client.post('/entities/report/', body);
      }),
  );

  server.registerTool(
    'find_issue_reports',
    {
      description: 'Search saved issue reports (filter by id/shortId/author).',
      inputSchema: z.object({
        filter: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Only id, shortId, author keys are supported'),
        orderBy: z.string().optional(),
        orderAsc: z.boolean().optional(),
        perPage: z.number().optional(),
        page: z.number().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { perPage, page, ...body } = args;
        return client.post('/entities/report/_search', body, { perPage, page });
      }),
  );

  server.registerTool(
    'get_search_suggest',
    {
      description:
        'Autocomplete suggestions for issue summaries — use when the user references ' +
        'an issue by an imprecise name. Returns matching issues with keys.',
      inputSchema: z.object({
        input: z.string().describe('Text fragment of the issue summary'),
        queue: z.string().optional().describe('Limit suggestions to one queue'),
      }),
    },
    async (args) =>
      runTool(async () => client.get('/issues/_suggest', args)),
  );
}
