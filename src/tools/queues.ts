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
        queueId: z.string().describe('Queue key'),
        name: z.string().describe('Version name'),
        description: z.string().optional().describe('Version description'),
        startDate: z.string().optional().describe('Start date, format YYYY-MM-DD'),
        dueDate: z.string().optional().describe('Due date, format YYYY-MM-DD'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, ...body } = args;
        return client.post('/versions', { queue: queueId, ...body });
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

  server.registerTool(
    'get_queue_autoaction',
    {
      description: 'Get parameters of one autoaction.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        autoactionId: z.number(),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/queues/${encodeURIComponent(String(args.queueId))}/autoactions/${args.autoactionId}`,
        ),
      ),
  );

  server.registerTool(
    'create_queue_autoaction',
    {
      description:
        'Create an autoaction: periodically updates issues matching filter/query. ' +
        'Actions are trigger-style objects (Transition, Update, CreateComment, Webhook, CalculateFormula).',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        name: z.string(),
        filter: z.record(z.string(), z.unknown()).optional().describe('Field-value issue filter'),
        query: z.string().optional().describe('Query language filter (XOR with filter)'),
        actions: z.array(z.record(z.string(), z.unknown())).describe('Action objects'),
        active: z.boolean().optional(),
        enableNotifications: z.boolean().optional(),
        intervalMillis: z.number().optional().describe('Run interval, default 3600000'),
        calendar: z.record(z.string(), z.unknown()).optional().describe('{"id": <schedule id>}'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, ...body } = args;
        return client.post(`/queues/${encodeURIComponent(String(queueId))}/autoactions`, body);
      }),
  );

  server.registerTool(
    'get_queue_autoaction_logs',
    {
      description:
        'Autoaction run logs. Without runId — list of launches; with runId — one launch ' +
        'with per-issue results (available for auto-update type autoactions).',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        autoactionId: z.number(),
        runId: z.string().optional().describe('Launch id for the detailed view'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, autoactionId, runId } = args;
        const base = `/queues/${encodeURIComponent(String(queueId))}/autoactions/${autoactionId}/logs`;
        return client.get(runId ? `${base}/${encodeURIComponent(runId)}` : base);
      }),
  );

  // --- Очередь: удаление, восстановление, теги ----------------------------------------

  server.registerTool(
    'delete_queue',
    {
      description:
        'Delete a queue (only when empty of issues). Only queue owner or Tracker admin can.',
      inputSchema: z.object({ queueId: z.string().or(z.number()) }),
    },
    async (args) =>
      runTool(async () => client.delete(`/queues/${encodeURIComponent(String(args.queueId))}`)),
  );

  server.registerTool(
    'restore_queue',
    {
      description: 'Restore a deleted queue (Tracker admin only).',
      inputSchema: z.object({ queueId: z.string().or(z.number()) }),
    },
    async (args) =>
      runTool(async () =>
        client.post(`/queues/${encodeURIComponent(String(args.queueId))}/_restore`),
      ),
  );

  server.registerTool(
    'delete_queue_tag',
    {
      description: 'Remove a tag from a queue (must not be used in any issue; admin only).',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        tag: z.string().describe('Tag name'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, tag } = args;
        return client.post(
          `/queues/${encodeURIComponent(String(queueId))}/tags/_remove`,
          { tag },
        );
      }),
  );

  // --- Права доступа к очереди ------------------------------------------------------------

  server.registerTool(
    'set_queue_access',
    {
      description:
        'Change queue access rights: create/write/read/grant/deny with users, groups ' +
        'and roles. Arrays overwrite; {"add": […], "remove": […]} apply deltas. ' +
        'deny supports only users and groups.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        permissions: z
          .record(z.string(), z.unknown())
          .describe(
            'e.g. {"read": {"users": {"add": ["login"]}}, "write": {"groups": [42]}, ' +
            '"grant": {"roles": ["author"]}}',
          ),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, permissions } = args;
        return client.patch(`/queues/${encodeURIComponent(String(queueId))}/permissions`, permissions);
      }),
  );

  server.registerTool(
    'get_queue_user_access',
    {
      description: 'Get user permissions in a queue.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        userId: z.string().or(z.number()).describe('Login or user id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/queues/${encodeURIComponent(String(args.queueId))}/permissions/users/${encodeURIComponent(String(args.userId))}`,
        ),
      ),
  );

  server.registerTool(
    'get_queue_group_access',
    {
      description: 'Get group permissions in a queue.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        groupId: z.number(),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/queues/${encodeURIComponent(String(args.queueId))}/permissions/groups/${args.groupId}`,
        ),
      ),
  );

  // --- Локальные поля очереди --------------------------------------------------------------

  const localFieldType = z
    .string()
    .describe('ru.yandex.startrek.core.fields.{Date|DateTime|String|Text|Float|Integer|User|Uri|Money|MoneyWithRate|TimeTrackingDuration}FieldType');

  server.registerTool(
    'create_queue_local_field',
    {
      description: 'Create a local (queue-specific) issue field.',
      inputSchema: z.object({
        queueId: z.string(),
        name: z.union([z.string(), z.record(z.string(), z.string())]).describe('{"ru": "…", "en": "…"}'),
        id: z.string().describe('Field key (latin)'),
        category: z.string().describe('Category id'),
        type: localFieldType,
        optionsProvider: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('{"type": "FixedListOptionsProvider|FixedUserListOptionsProvider", "values": […]}'),
        order: z.number().optional(),
        description: z.string().optional(),
        readonly: z.boolean().optional(),
        visible: z.boolean().optional(),
        container: z.boolean().optional().describe('Multi-value (string/user/dropdown only)'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, ...body } = args;
        return client.post(`/queues/${encodeURIComponent(queueId)}/localFields`, body);
      }),
  );

  server.registerTool(
    'get_queue_local_field',
    {
      description: 'Get one local field of a queue by its key.',
      inputSchema: z.object({
        queueId: z.string(),
        fieldKey: z.string().describe('Local field key (from get_queue_local_fields)'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/queues/${encodeURIComponent(args.queueId)}/localFields/${encodeURIComponent(args.fieldKey)}`,
        ),
      ),
  );

  server.registerTool(
    'update_queue_local_field',
    {
      description: 'Edit a local field of a queue: name, category, options, visibility.',
      inputSchema: z.object({
        queueId: z.string(),
        fieldKey: z.string(),
        name: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
        category: z.string().optional(),
        order: z.number().optional(),
        description: z.string().optional(),
        optionsProvider: z.record(z.string(), z.unknown()).optional(),
        readonly: z.boolean().optional(),
        visible: z.boolean().optional(),
        hidden: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, fieldKey, ...body } = args;
        return client.patch(
          `/queues/${encodeURIComponent(queueId)}/localFields/${encodeURIComponent(fieldKey)}`,
          body,
        );
      }),
  );

  // --- Компоненты (уровень организации) -------------------------------------------------

  server.registerTool(
    'get_components',
    {
      description: 'List all components of the organization.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/components')),
  );

  server.registerTool(
    'get_component',
    {
      description: 'Get one component by id.',
      inputSchema: z.object({
        componentId: z.number(),
        fields: z.string().optional().describe('Comma-separated fields to include'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/components/${args.componentId}`, args.fields ? { fields: args.fields } : undefined),
      ),
  );

  server.registerTool(
    'update_component',
    {
      description: 'Edit a component: name, description, owner, default assignee. version = component version.',
      inputSchema: z.object({
        componentId: z.number(),
        version: z.number().describe('Current component version'),
        name: z.string().optional(),
        description: z.string().optional(),
        lead: z.string().optional().describe('Owner login'),
        assignAuto: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { componentId, version, ...body } = args;
        return client.patch(`/components/${componentId}`, body, { version });
      }),
  );

  server.registerTool(
    'delete_component',
    {
      description: 'Delete a component by id.',
      inputSchema: z.object({ componentId: z.number() }),
    },
    async (args) => runTool(async () => client.delete(`/components/${args.componentId}`)),
  );

  server.registerTool(
    'get_component_user_access',
    {
      description: 'Get user permissions for a component.',
      inputSchema: z.object({
        componentId: z.number(),
        userId: z.string().or(z.number()),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/components/${args.componentId}/permissions/users/${encodeURIComponent(String(args.userId))}`,
        ),
      ),
  );

  server.registerTool(
    'get_component_group_access',
    {
      description: 'Get group permissions for a component.',
      inputSchema: z.object({
        componentId: z.number(),
        groupId: z.number(),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/components/${args.componentId}/permissions/groups/${args.groupId}`),
      ),
  );

  // --- Версии очередей (одиночные) -----------------------------------------------------

  server.registerTool(
    'get_queue_version',
    {
      description: 'Get one queue version by id.',
      inputSchema: z.object({
        versionId: z.number(),
        fields: z.string().optional().describe('Comma-separated fields to include'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/versions/${args.versionId}`, args.fields ? { fields: args.fields } : undefined),
      ),
  );

  server.registerTool(
    'update_queue_version',
    {
      description: 'Edit a queue version: name, description, dates.',
      inputSchema: z.object({
        versionId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        startDate: z.string().optional().describe('YYYY-MM-DD'),
        dueDate: z.string().optional().describe('YYYY-MM-DD'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { versionId, ...body } = args;
        return client.patch(`/versions/${versionId}`, body);
      }),
  );

  server.registerTool(
    'delete_queue_version',
    {
      description: 'Delete a queue version by id.',
      inputSchema: z.object({ versionId: z.number() }),
    },
    async (args) => runTool(async () => client.delete(`/versions/${args.versionId}`)),
  );

  // --- Триггеры ------------------------------------------------------------------------------

  server.registerTool(
    'get_queue_trigger',
    {
      description: 'Get one trigger of a queue.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        triggerId: z.number(),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/queues/${encodeURIComponent(String(args.queueId))}/triggers/${args.triggerId}`,
        ),
      ),
  );

  server.registerTool(
    'create_queue_trigger',
    {
      description:
        'Create a queue trigger. actions: Transition/Update/CreateComment/Webhook/CalculateFormula/… ' +
        'objects; conditions: field/event checks, single object {"type": "Or"|"And", "conditions": […]}.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        name: z.string(),
        actions: z.array(z.record(z.string(), z.unknown())).describe('Action objects'),
        conditions: z
          .union([z.array(z.record(z.string(), z.unknown())), z.record(z.string(), z.unknown())])
          .optional()
          .describe('Condition objects or {"type": "And"|"Or", "conditions": […]}'),
        active: z.boolean().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, ...body } = args;
        return client.post(`/queues/${encodeURIComponent(String(queueId))}/triggers`, body);
      }),
  );

  server.registerTool(
    'update_queue_trigger',
    {
      description:
        'Edit a trigger: name, actions, conditions, position (version = trigger version).',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        triggerId: z.number(),
        version: z.number().describe('Current trigger version'),
        name: z.string().optional(),
        actions: z.array(z.record(z.string(), z.unknown())).optional(),
        conditions: z
          .union([z.array(z.record(z.string(), z.unknown())), z.record(z.string(), z.unknown())])
          .optional(),
        active: z.boolean().optional(),
        before: z.number().optional().describe('Trigger id to place this one before'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, triggerId, version, ...body } = args;
        return client.patch(
          `/queues/${encodeURIComponent(String(queueId))}/triggers/${triggerId}`,
          body,
          { version },
        );
      }),
  );

  server.registerTool(
    'get_queue_trigger_logs',
    {
      description:
        'Webhook-action execution logs of a trigger (optionally for one issue, time range).',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        triggerId: z.number(),
        issueId: z.string().optional().describe('Filter logs by issue'),
        limit: z.number().optional().describe('Records, default 10, max 100'),
        from: z.string().optional().describe('YYYY-MM-DDThh:mm:ss.sss±hhmm'),
        to: z.string().optional().describe('YYYY-MM-DDThh:mm:ss.sss±hhmm'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, triggerId, ...query } = args;
        return client.get(
          `/queues/${encodeURIComponent(String(queueId))}/triggers/${triggerId}/webhooks/log`,
          query,
        );
      }),
  );

  // --- Макросы --------------------------------------------------------------------------------

  server.registerTool(
    'get_queue_macro',
    {
      description: 'Get one macro of a queue.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        macroId: z.string().or(z.number()),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/queues/${encodeURIComponent(String(args.queueId))}/macros/${encodeURIComponent(String(args.macroId))}`,
        ),
      ),
  );

  server.registerTool(
    'create_queue_macro',
    {
      description: 'Create a queue macro: comment body and/or issue field updates applied on run.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        name: z.string(),
        body: z.string().optional().describe('Comment text created on run',
        ),
        issueUpdate: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Field → value map (null clears; supports set/add/remove operators)'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, ...body } = args;
        return client.post(`/queues/${encodeURIComponent(String(queueId))}/macros`, body);
      }),
  );

  server.registerTool(
    'update_queue_macro',
    {
      description: 'Edit a queue macro: name, comment body, issue updates.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        macroId: z.string().or(z.number()),
        name: z.string().optional(),
        body: z.string().optional(),
        issueUpdate: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, macroId, ...body } = args;
        return client.patch(
          `/queues/${encodeURIComponent(String(queueId))}/macros/${encodeURIComponent(String(macroId))}`,
          body,
        );
      }),
  );

  server.registerTool(
    'delete_queue_macro',
    {
      description: 'Delete a queue macro.',
      inputSchema: z.object({
        queueId: z.string().or(z.number()),
        macroId: z.string().or(z.number()),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queueId, macroId } = args;
        return client.delete(
          `/queues/${encodeURIComponent(String(queueId))}/macros/${encodeURIComponent(String(macroId))}`,
        );
      }),
  );
}
