import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { dangerTool, runTool } from '../utils.js';

export function registerWorklogTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_issue_worklog',
    {
      description: 'Get time tracking records (worklog) of an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/issues/${encodeURIComponent(args.issueId)}/worklog`)),
  );

  server.registerTool(
    'add_worklog_record',
    {
      description:
        'Add a time tracking record to an issue. Tracker counts time in 5-day work weeks ' +
        'and 8-hour work days: P5D is displayed as 1 week.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        start: z
          .string()
          .describe('Work start date and time, format YYYY-MM-DDThh:mm:ss.sss±hhmm'),
        duration: z
          .string()
          .describe('Spent time in ISO 8601 duration format, e.g. "PT2H30M", "P3D", "P1WT4H"'),
        comment: z.string().optional().describe('Worklog comment'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...body } = args;
        return client.post(`/issues/${encodeURIComponent(issueId)}/worklog`, body);
      }),
  );

  server.registerTool(
    'edit_worklog_record',
    {
      description: 'Edit a time tracking record (worklog).',
      inputSchema: z.object({
        worklogId: z.string().describe('Worklog record id (from get_issue_worklog)'),
        duration: z.string().optional().describe('New duration in ISO 8601 format, e.g. "PT2H"'),
        comment: z.string().optional().describe('New comment'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { worklogId, ...body } = args;
        return client.patch(`/worklog/${encodeURIComponent(worklogId)}`, body);
      }),
  );

  server.registerTool(
    'find_worklog_records',
    {
      description:
        'Search worklog records across all issues by author and/or creation date range.',
      inputSchema: z.object({
        createdBy: z.string().optional().describe('Author login or id'),
        createdFrom: z.string().optional().describe('From, YYYY-MM-DDThh:mm:ss.sss±hhmm'),
        createdTo: z.string().optional().describe('To, YYYY-MM-DDThh:mm:ss.sss±hhmm'),
      }),
    },
    async (args) => {
      return runTool(async () => {
        const body: Record<string, unknown> = {};
        if (args.createdBy !== undefined) body.createdBy = args.createdBy;
        if (args.createdFrom !== undefined || args.createdTo !== undefined) {
          body.createdAt = {
            from: args.createdFrom,
            to: args.createdTo,
          };
        }
        return client.post('/worklog/_search', body);
      });
    },
  );

  server.registerTool(
    'delete_worklog_record',
    {
      description: 'Delete a time tracking record (worklog).',
      inputSchema: z.object({
        confirm: z.boolean().optional().describe('Set to true to confirm this destructive/bulk operation'),
        worklogId: z.string().describe('Worklog record id (from get_issue_worklog)'),
      }),
    },
    async (args) =>
      dangerTool(args, async () => client.delete(`/worklog/${encodeURIComponent(args.worklogId)}`)),
  );
}
