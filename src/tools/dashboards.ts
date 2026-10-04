import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerDashboardTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'create_dashboard',
    {
      description: 'Create a new dashboard.',
      inputSchema: z.object({
        name: z.string().describe('Dashboard name'),
        layout: z
          .enum([
            'one-column',
            'two-columns',
            'three-columns',
            'narrow-left-wide-right',
            'one-top-two-bottom',
          ])
          .optional()
          .describe('Widget layout mode, default "one-column"'),
        owner: z
          .string()
          .optional()
          .describe('Owner login or id (defaults to the creator)'),
      }),
    },
    async (args) => runTool(async () => client.post('/dashboards', args)),
  );

  server.registerTool(
    'create_cycle_time_widget',
    {
      description:
        'Add a "Cycle time" chart widget to an existing dashboard. ' +
        'Issue source priority: filterId > query > filter.',
      inputSchema: z.object({
        dashboardId: z.number().describe('Target dashboard id'),
        description: z.string().describe('Widget title'),
        query: z
          .string()
          .optional()
          .describe('Issue filter in Tracker query language, e.g. "Queue: KEY Assignee: me()"'),
        filter: z.record(z.string(), z.unknown()).optional().describe('Issue filter by fields'),
        filterId: z.number().optional().describe('Saved filter id'),
        fromStatuses: z
          .array(z.object({ key: z.string() }))
          .optional()
          .describe('Status where work starts (excluded from the count)'),
        toStatuses: z
          .array(z.object({ key: z.string() }))
          .optional()
          .describe('Status where work ends'),
        excludedStatuses: z.array(z.unknown()).optional().describe('Statuses to exclude'),
        includedStatuses: z.array(z.unknown()).optional().describe('Statuses to include'),
        bucket: z
          .object({
            unit: z.enum(['days', 'weeks', 'months', 'sprints']),
            count: z.number().optional(),
            boardId: z.string().optional().describe('Board id, when unit is "sprints"'),
          })
          .optional()
          .describe('Chart step, default 7 days'),
        lines: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Time axis settings: movingAverage, standardDeviation, percentile, cakePercentile'),
        start: z.string().optional().describe('Start formula, e.g. "now()-2w" (default 2 years)'),
        end: z.string().optional().describe('End formula, e.g. "now()-2d" (default now())'),
        mode: z
          .enum(['common-lines', 'common-lines-and-points', 'status-lines'])
          .optional()
          .describe('Chart display mode'),
        autoUpdatable: z.boolean().optional().describe('Auto-refresh the chart'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { dashboardId, ...body } = args;
        return client.post(`/dashboards/${dashboardId}/widgets/cycleTime`, body);
      }),
  );
}
