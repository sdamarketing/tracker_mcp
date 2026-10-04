import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

const workflowTypes = z
  .enum(['vacation', 'paid_day_off', 'illness', 'absence', 'trip', 'conference_trip', 'conference', 'learning', 'maternity', 'duty'])
  .describe('Absence type');

const gapSchema = z.object({
  user: z.string().describe('Login or user id'),
  workflow: workflowTypes,
  from: z.string().describe('Start, ISO 8601 (YYYY-MM-DDThh:mm:ss.sss±hhmm)'),
  to: z.string().describe('End, ISO 8601, must be later than from'),
  id: z.string().optional().describe('Custom id (≤128 chars); auto-generated if omitted'),
  fullDay: z.boolean().optional(),
  workInAbsence: z.boolean().optional().describe('Works during the absence'),
});

export function registerGapTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'create_gaps',
    {
      description: 'Create employee absences (vacation, illness, trip…). Admin rights required.',
      inputSchema: z.object({ gaps: z.array(gapSchema).max(100) }),
    },
    async (args) => runTool(async () => client.post('/gaps', args)),
  );

  server.registerTool(
    'find_gaps',
    {
      description:
        'Find absences of given users in a date range (admin). Pass the last user uid ' +
        'from the previous page to page through large organizations.',
      inputSchema: z.object({
        users: z.array(z.string()).max(100).describe('Logins or user ids'),
        from: z.string().optional().describe('Range start, ISO 8601 (default now)'),
        to: z.string().optional().describe('Range end, ISO 8601'),
        page: z.number().optional(),
        perPage: z.number().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { page, perPage, ...body } = args;
        return client.post('/gaps/_search', body, { page, perPage });
      }),
  );

  server.registerTool(
    'delete_gaps',
    {
      description: 'Delete absences by ids (admin).',
      inputSchema: z.object({
        gapIds: z.array(z.string()).max(100).describe('Absence ids'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete('/gaps', { gapIds: args.gapIds.join(',') }),
      ),
  );
}
