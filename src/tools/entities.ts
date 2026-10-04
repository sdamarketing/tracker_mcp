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

  // --- Комментарии сущностей: одиночные операции -------------------------------

  server.registerTool(
    'get_entity_comment',
    {
      description: 'Get one comment of a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        commentId: z.string(),
        expand: z.string().optional().describe('"all", "html", "attachments" or "reactions"'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, commentId, expand } = args;
        return client.get(
          `${entityPath(entityType, entityId)}/comments/${encodeURIComponent(commentId)}`,
          expand ? { expand } : undefined,
        );
      }),
  );

  server.registerTool(
    'update_entity_comment',
    {
      description: 'Edit a comment of a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        commentId: z.string(),
        text: z.string().describe('New comment text'),
        attachmentIds: z.array(z.string()).optional().describe('Temp file ids to attach'),
        notify: z.boolean().optional().describe('Notify users (default true)'),
        notifyAuthor: z.boolean().optional().describe('Notify the author (default false)'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, commentId, notify, notifyAuthor, ...body } = args;
        return client.patch(
          `${entityPath(entityType, entityId)}/comments/${encodeURIComponent(commentId)}`,
          body,
          { notify, notifyAuthor },
        );
      }),
  );

  server.registerTool(
    'delete_entity_comment',
    {
      description: 'Delete a comment of a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        commentId: z.string(),
        notify: z.boolean().optional(),
        notifyAuthor: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, commentId, notify, notifyAuthor } = args;
        return client.delete(
          `${entityPath(entityType, entityId)}/comments/${encodeURIComponent(commentId)}`,
          { notify, notifyAuthor },
        );
      }),
  );

  // --- Чеклисты сущностей (проекты и портфели) ---------------------------------

  const checklistEntityType = z
    .enum(['project', 'portfolio'])
    .describe('Checklists are available for projects and portfolios only');

  const checklistItem = z.object({
    text: z.string().describe('Item text'),
    checked: z.boolean().optional(),
    assignee: z.string().or(z.number()).optional(),
    deadline: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('{"date": "YYYY-MM-DDThh:mm:ss.sss±hhmm", "deadlineType": "date"}'),
  });

  server.registerTool(
    'add_entity_checklist_items',
    {
      description: 'Create a checklist or append items to a project/portfolio checklist.',
      inputSchema: z.object({
        entityType: checklistEntityType,
        entityId: z.string(),
        items: z.array(checklistItem).min(1),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, items, notify } = args;
        return client.post(
          `${entityPath(entityType, entityId)}/checklistItems`,
          items,
          notify !== undefined ? { notify } : undefined,
        );
      }),
  );

  server.registerTool(
    'update_entity_checklist',
    {
      description:
        'Bulk-edit ALL checklist items of a project/portfolio (item count cannot change; ' +
        'omitted optional fields are reset).',
      inputSchema: z.object({
        entityType: checklistEntityType,
        entityId: z.string(),
        items: z
          .array(
            z.object({
              id: z.string(),
              text: z.string(),
              checked: z.boolean().optional(),
              assignee: z.string().or(z.number()).optional(),
              deadline: z.record(z.string(), z.unknown()).optional(),
            }),
          )
          .min(1),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, items, notify } = args;
        return client.patch(
          `${entityPath(entityType, entityId)}/checklistItems`,
          items,
          notify !== undefined ? { notify } : undefined,
        );
      }),
  );

  server.registerTool(
    'update_entity_checklist_item',
    {
      description: 'Edit a single checklist item of a project/portfolio.',
      inputSchema: z.object({
        entityType: checklistEntityType,
        entityId: z.string(),
        itemId: z.string(),
        text: z.string().optional(),
        checked: z.boolean().optional(),
        assignee: z.string().or(z.number()).optional(),
        deadline: z.record(z.string(), z.unknown()).optional(),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, itemId, notify, ...body } = args;
        return client.patch(
          `${entityPath(entityType, entityId)}/checklistItems/${encodeURIComponent(itemId)}`,
          body,
          notify !== undefined ? { notify } : undefined,
        );
      }),
  );

  server.registerTool(
    'move_entity_checklist_item',
    {
      description: 'Move a checklist item of a project/portfolio before another item.',
      inputSchema: z.object({
        entityType: checklistEntityType,
        entityId: z.string(),
        itemId: z.string(),
        before: z.string().describe('Id of the item to insert before'),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, itemId, before, notify } = args;
        return client.post(
          `${entityPath(entityType, entityId)}/checklistItems/${encodeURIComponent(itemId)}/_move`,
          { before },
          notify !== undefined ? { notify } : undefined,
        );
      }),
  );

  server.registerTool(
    'delete_entity_checklist',
    {
      description: 'Delete all checklist items of a project/portfolio.',
      inputSchema: z.object({
        entityType: checklistEntityType,
        entityId: z.string(),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, notify } = args;
        return client.delete(`${entityPath(entityType, entityId)}/checklistItems`, {
          ...(notify !== undefined ? { notify } : {}),
        });
      }),
  );

  server.registerTool(
    'delete_entity_checklist_item',
    {
      description: 'Delete one checklist item of a project/portfolio.',
      inputSchema: z.object({
        entityType: checklistEntityType,
        entityId: z.string(),
        itemId: z.string(),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, itemId, notify } = args;
        return client.delete(
          `${entityPath(entityType, entityId)}/checklistItems/${encodeURIComponent(itemId)}`,
          { ...(notify !== undefined ? { notify } : {}) },
        );
      }),
  );

  // --- Вложения сущностей --------------------------------------------------------

  server.registerTool(
    'list_entity_attachments',
    {
      description: 'List files attached to a project, portfolio or goal.',
      inputSchema: z.object({ entityType: entityTypeSchema, entityId: z.string() }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`${entityPath(args.entityType, args.entityId)}/attachments`),
      ),
  );

  server.registerTool(
    'get_entity_attachment',
    {
      description: 'Get metadata of one file attached to a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        attachmentId: z.string().or(z.number()),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `${entityPath(args.entityType, args.entityId)}/attachments/${encodeURIComponent(String(args.attachmentId))}`,
        ),
      ),
  );

  server.registerTool(
    'add_entity_attachment',
    {
      description:
        'Attach a temporary file (from upload_temp_attachment) to a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        tempFileId: z.string().or(z.number()).describe('Temp file id from upload_temp_attachment'),
        notify: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, tempFileId, notify } = args;
        return client.post(
          `${entityPath(entityType, entityId)}/attachments/${encodeURIComponent(String(tempFileId))}`,
          undefined,
          notify !== undefined ? { notify } : undefined,
        );
      }),
  );

  server.registerTool(
    'delete_entity_attachment',
    {
      description: 'Delete a file from a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        attachmentId: z.string().or(z.number()),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(
          `${entityPath(args.entityType, args.entityId)}/attachments/${encodeURIComponent(String(args.attachmentId))}`,
        ),
      ),
  );

  // --- Связи сущностей ---------------------------------------------------------------

  server.registerTool(
    'create_entity_link',
    {
      description:
        'Link a project/portfolio/goal to other entities. Relationships: ' +
        'projects/portfolios "depends on", "is dependent by", "works towards" (→ goal); ' +
        'goals "parent entity", "child entity", "is supported by" (← project).',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        links: z
          .array(z.object({ relationship: z.string(), entity: z.string() }))
          .min(1)
          .describe('One or many links in a single call'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, links } = args;
        const body = links.length === 1 ? links[0] : links;
        return client.post(`${entityPath(entityType, entityId)}/links`, body);
      }),
  );

  server.registerTool(
    'get_entity_links',
    {
      description: 'List entity links of a project, portfolio or goal.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        fields: z.string().optional().describe('Comma-separated fields of linked entities, e.g. "id,summary"'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, fields } = args;
        return client.get(
          `${entityPath(entityType, entityId)}/links`,
          fields ? { fields } : undefined,
        );
      }),
  );

  server.registerTool(
    'delete_entity_link',
    {
      description: 'Unlink an entity from another entity (by the linked entity id).',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        right: z.string().describe('Id of the entity to unlink'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, right } = args;
        return client.delete(`${entityPath(entityType, entityId)}/links`, { right });
      }),
  );

  // --- События и массовые операции ------------------------------------------------

  server.registerTool(
    'get_entity_events',
    {
      description:
        'Event history of a project, portfolio or goal (relative pagination: pass the ' +
        'last event id as "from" or focus with "selected").',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        perPage: z.number().optional(),
        from: z.string().optional().describe('Show events after this event id (exclusive)'),
        selected: z
          .string()
          .optional()
          .describe('Show a window around this event id (not combinable with "from")'),
        newEventsOnTop: z.boolean().optional(),
        direction: z.enum(['forward', 'backward']).optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, ...query } = args;
        return client.get(`${entityPath(entityType, entityId)}/events/_relative`, query);
      }),
  );

  server.registerTool(
    'bulk_update_entities',
    {
      description: 'Bulk update projects, portfolios or goals: fields, comment and links at once.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        metaEntities: z.array(z.string()).min(1).describe('Entity ids to update'),
        fields: z.record(z.string(), z.unknown()).optional(),
        comment: z.string().optional().describe('Comment to add to every entity'),
        links: z
          .array(z.object({ relationship: z.string(), entity: z.string() }))
          .optional()
          .describe('Links to add to every entity'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, ...body } = args;
        return client.post(`/entities/${encodeURIComponent(entityType)}/bulkchange/_update`, body);
      }),
  );

  // --- Права доступа ------------------------------------------------------------------

  server.registerTool(
    'get_entity_access',
    {
      description: 'Get extended access settings of an entity, including inheritance sources.',
      inputSchema: z.object({ entityType: entityTypeSchema, entityId: z.string() }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`${entityPath(args.entityType, args.entityId)}/extendedPermissions`),
      ),
  );

  server.registerTool(
    'update_entity_access',
    {
      description:
        'Update extended access settings: enable/disable inheritance (permissionSources) ' +
        'and/or grant/revoke acl. Disable inheritance first — acl changes are rejected while inherited.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        permissionSources: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe('Parent entity id(s) to inherit from; [] disables inheritance'),
        acl: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('{"grant"|"revoke": {"READ"|"GRANT"|"WRITE": {"users": […], "groups": […], "roles": […]}}}',
          ),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, ...body } = args;
        return client.patch(`${entityPath(entityType, entityId)}/extendedPermissions`, body);
      }),
  );

  server.registerTool(
    'get_entity_permissions',
    {
      description: 'Get direct access permissions (READ/GRANT/WRITE) of an entity.',
      inputSchema: z.object({ entityType: entityTypeSchema, entityId: z.string() }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`${entityPath(args.entityType, args.entityId)}/permissions`),
      ),
  );

  server.registerTool(
    'update_entity_permissions',
    {
      description:
        'Grant/revoke direct permissions on an entity. roles: AUTHOR|OWNER|CLIENT|FOLLOWER|MEMBER.',
      inputSchema: z.object({
        entityType: entityTypeSchema,
        entityId: z.string(),
        grant: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('{"READ"|"GRANT"|"WRITE": {"users": […], "groups": […], "roles": […]}}'),
        revoke: z.record(z.string(), z.unknown()).optional().describe('Same shape as grant'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { entityType, entityId, ...body } = args;
        return client.patch(`${entityPath(entityType, entityId)}/permissions`, body);
      }),
  );
}
