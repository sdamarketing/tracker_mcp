import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerUserTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_current_user',
    {
      description:
        'Get info about the current user (the token owner). Good for connectivity checks.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/myself')),
  );

  server.registerTool(
    'get_user',
    {
      description: 'Get user info by login or uid.',
      inputSchema: z.object({
        login: z.string().describe('User login or uid, e.g. "user1" or "112000000001"'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/users/${encodeURIComponent(args.login)}`)),
  );

  server.registerTool(
    'get_users',
    {
      description: 'List users of the organization.',
      inputSchema: z.object({
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) => runTool(async () => client.get('/users', args)),
  );
}

export function registerAdminTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_issue_types',
    {
      description: 'List all issue types (task, bug, epic, ...) available in the organization.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/issuetypes')),
  );

  server.registerTool(
    'get_statuses',
    {
      description: 'List all issue statuses.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/statuses')),
  );

  server.registerTool(
    'get_priorities',
    {
      description: 'List all issue priorities.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/priorities')),
  );

  server.registerTool(
    'get_resolutions',
    {
      description: 'List all issue resolutions.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/resolutions')),
  );

  server.registerTool(
    'get_issue_fields',
    {
      description:
        'List all global issue fields (standard and custom) with their types and options — ' +
        'useful to discover field ids for filters, create and edit operations.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/fields')),
  );
}
