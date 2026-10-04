import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

const entityTypeSchema = z
  .enum(['project', 'portfolio', 'goal'])
  .describe('Entity type: "project", "portfolio" or "goal"');

const entityFieldsSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    'Additional entity fields: description, lead, teamUsers, clients, followers, start, ' +
    'end, tags, entityStatus, teamAccess, parentEntity ({"primary": "id", "secondary": []}). ' +
    'Example: {"entityStatus": "in_progress", "lead": "user1", "end": "2026-12-31"}',
  );

function entityPath(entityType: string, entityId?: string): string {
  const base = `/entities/${encodeURIComponent(entityType)}`;
  return entityId ? `${base}/${encodeURIComponent(entityId)}` : base;
}

export function registerEntityTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'search_entities',
    {
      description:
        'Search projects, portfolios or goals. Filter by name substring, field values or ' +
        'sort the result. Use entityType "goal" for OKR goals, "portfolio" for project portfolios.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        input: z.string().optional().describe('Substring of the entity name'),
        filter: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Field filter, e.g. {"entityStatus": "in_progress", "lead": "user1"}'),
        orderBy: z.string().optional().describe('Field key to sort by, e.g. "entityStatus"'),
        orderAsc: z.boolean().optional().describe('Sort ascending (default false)'),
        rootOnly: z.boolean().optional().describe('Only return top-level entities'),
        fields: z
          .string()
          .optional()
          .describe(
            'Comma-separated extra fields to include, e.g. "entityStatus,author,followers"',
          ),
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, ...rest } = args;
        const { fields, perPage, page, ...body } = rest;
        return client.post(
          `${entityPath(entityType)}/_search`,
          body,
          { fields, perPage, page },
        );
      }),
  );

  server.registerTool(
    'get_entity',
    {
      description: 'Get a project, portfolio or goal by id (use search_entities to find ids).',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string().describe('Entity id'),
        fields: z.string().optional().describe('Comma-separated extra fields to include'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, fields } = args;
        return client.get(entityPath(entityType, entityId), fields ? { fields } : undefined);
      }),
  );

  server.registerTool(
    'create_entity',
    {
      description: 'Create a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        summary: z.string().describe('Entity name'),
        fields: entityFieldsSchema,
        links: z
          .array(
            z.object({
              relationship: z
                .string()
                .describe(
                  'Link type, e.g. "works towards" (project→goal), "depends on", ' +
                  '"is dependent by", "parent entity", "child entity", "is supported by"',
                ),
              entity: z.string().describe('Linked entity id'),
            }),
          )
          .optional()
          .describe('Entity links'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, summary, fields, links } = args;
        const body: Record<string, unknown> = {
          fields: { summary, ...(fields ?? {}) },
        };
        if (links) body.links = links;
        return client.post(entityPath(entityType), body);
      }),
  );

  server.registerTool(
    'update_entity',
    {
      description: 'Update a project, portfolio or goal by id.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string().describe('Entity id'),
        fields: z
          .record(z.string(), z.unknown())
          .describe(
            'Fields to update, e.g. {"summary": "New name", "entityStatus": "at_risk", ' +
            '"parentEntity": {"primary": "portfolio-id", "secondary": []}} or with ' +
            'set/add commands like {"teamUsers": {"add": ["user2"]}}',
          ),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, fields } = args;
        return client.patch(entityPath(entityType, entityId), { fields });
      }),
  );

  server.registerTool(
    'delete_entity',
    {
      description: 'Delete a project, portfolio or goal by id.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string().describe('Entity id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(entityPath(args.entityType, args.entityId)),
      ),
  );

  server.registerTool(
    'add_entity_comment',
    {
      description: 'Add a comment to a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string().describe('Entity id'),
        text: z.string().describe('Comment text'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, text } = args;
        return client.post(`${entityPath(entityType, entityId)}/comments`, { text });
      }),
  );

  server.registerTool(
    'get_entity_comments',
    {
      description: 'List comments of a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string().describe('Entity id'),
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, ...query } = args;
        return client.get(`${entityPath(entityType, entityId)}/comments`, query);
      }),
  );
}
