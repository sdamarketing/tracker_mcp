import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';
import { cached, invalidatePrefix } from '../cache.js';

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
      description:
        'List users of the organization (up to 10 000 — use get_users_relative beyond). ' +
        'Filter by email or group.',
      inputSchema: z.object({
        perPage: z.number().min(1).max(100).optional(),
        id: z.number().optional().describe('User uid to start from'),
        email: z.string().optional().describe('Find user by email'),
        group: z.number().optional().describe('Filter by group id'),
        expand: z.string().optional().describe('"groups" to include user groups'),
      }),
    },
    async (args) => runTool(async () => client.get('/users', args)),
  );

  server.registerTool(
    'get_users_relative',
    {
      description:
        'List users with relative pagination (works beyond the 10 000-user limit of ' +
        'get_users). Pass the last user uid as "id" to get the next page.',
      inputSchema: z.object({
        perPage: z.number().min(1).max(100).optional(),
        id: z.number().optional().describe('User uid to start from'),
        expand: z.string().optional().describe('"groups" to include user groups'),
      }),
    },
    async (args) => runTool(async () => client.get('/users/_relative', args)),
  );
}

export function registerAdminTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_issue_types',
    {
      description: 'List all issue types (task, bug, epic, ...) available in the organization.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => cached('catalog:issuetypes', () => client.get('/issuetypes'))),
  );

  server.registerTool(
    'get_statuses',
    {
      description: 'List all issue statuses.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => cached('catalog:statuses', () => client.get('/statuses'))),
  );

  server.registerTool(
    'get_priorities',
    {
      description: 'List all issue priorities.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => cached('catalog:priorities', () => client.get('/priorities'))),
  );

  server.registerTool(
    'get_resolutions',
    {
      description: 'List all issue resolutions.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => cached('catalog:resolutions', () => client.get('/resolutions'))),
  );

  server.registerTool(
    'get_issue_fields',
    {
      description:
        'List all global issue fields (standard and custom) with their types and options — ' +
        'useful to discover field ids for filters, create and edit operations.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => cached('catalog:fields', () => client.get('/fields'))),
  );

  const localized = z.record(z.string(), z.string()).describe('{"ru": "…", "en": "…"}');

  server.registerTool(
    'create_issue_type',
    {
      description: 'Create a new issue type (admin).',
      inputSchema: z.object({
        key: z.string().describe('Type key, latin'),
        name: localized,
      }),
    },
    async (args) => runTool(async () => { const r = await client.post('/issuetypes', args); invalidatePrefix('catalog:'); return r; }),
  );

  server.registerTool(
    'update_issue_type',
    {
      description: 'Rename an issue type (admin). version locks edits to that version.',
      inputSchema: z.object({
        typeKey: z.string().describe('Type key or id'),
        name: localized,
        version: z.number().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { typeKey, version, ...body } = args;
        invalidatePrefix('catalog:');
        return client.patch(
          `/issuetypes/${encodeURIComponent(typeKey)}`,
          body,
          version !== undefined ? { version } : undefined,
        );
      }),
  );

  server.registerTool(
    'create_status',
    {
      description: 'Create an issue status (admin).',
      inputSchema: z.object({
        key: z.string().describe('Latin key starting with a lowercase letter'),
        name: localized,
        type: z
          .enum(['new', 'inProgress', 'paused', 'done', 'cancelled'])
          .describe('Status category'),
      }),
    },
    async (args) => runTool(async () => { const r = await client.post('/statuses', args); invalidatePrefix('catalog:'); return r; }),
  );

  server.registerTool(
    'update_status',
    {
      description: 'Edit an issue status: name, description, order, category (admin).',
      inputSchema: z.object({
        statusKey: z.string().describe('Status key or id'),
        name: localized.optional(),
        description: z.string().optional(),
        order: z.number().optional(),
        type: z.enum(['new', 'inProgress', 'paused', 'done', 'cancelled']).optional(),
        version: z.number().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { statusKey, version, ...body } = args;
        invalidatePrefix('catalog:');
        return client.patch(
          `/statuses/${encodeURIComponent(statusKey)}`,
          body,
          version !== undefined ? { version } : undefined,
        );
      }),
  );

  server.registerTool(
    'create_resolution',
    {
      description: 'Create a resolution (admin).',
      inputSchema: z.object({
        key: z.string().describe('Latin key starting with a lowercase letter'),
        name: localized,
      }),
    },
    async (args) => runTool(async () => { const r = await client.post('/resolutions', args); invalidatePrefix('catalog:'); return r; }),
  );

  server.registerTool(
    'update_resolution',
    {
      description: 'Edit a resolution: name, description, order (admin).',
      inputSchema: z.object({
        resolutionKey: z.string().describe('Resolution key or id'),
        name: localized.optional(),
        description: z.string().optional(),
        order: z.number().optional(),
        version: z.number().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { resolutionKey, version, ...body } = args;
        invalidatePrefix('catalog:');
        return client.patch(
          `/resolutions/${encodeURIComponent(resolutionKey)}`,
          body,
          version !== undefined ? { version } : undefined,
        );
      }),
  );

  server.registerTool(
    'create_priority',
    {
      description: 'Create a priority (admin).',
      inputSchema: z.object({
        key: z.string().describe('Priority key, latin'),
        name: localized,
        order: z.number().describe('Display weight'),
        description: z.string(),
      }),
    },
    async (args) => runTool(async () => { const r = await client.post('/priorities', args); invalidatePrefix('catalog:'); return r; }),
  );

  server.registerTool(
    'update_priority',
    {
      description: 'Edit a priority: name, description (admin). The icon cannot be changed.',
      inputSchema: z.object({
        priorityKey: z.string().describe('Priority key or id'),
        name: localized.optional(),
        description: z.string().optional(),
        version: z.number().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { priorityKey, version, ...body } = args;
        invalidatePrefix('catalog:');
        return client.patch(
          `/priorities/${encodeURIComponent(priorityKey)}`,
          body,
          version !== undefined ? { version } : undefined,
        );
      }),
  );
}
