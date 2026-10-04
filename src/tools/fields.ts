import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

const localized = z
  .union([z.string(), z.record(z.string(), z.string())])
  .describe('Name: string or {"ru": "…", "en": "…"}');

export function registerFieldTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_issue_field',
    {
      description: 'Get parameters of a single global issue field by its key (e.g. "tags", "priority").',
      inputSchema: z.object({ fieldId: z.string().describe('Field key') }),
    },
    async (args) => runTool(async () => client.get(`/fields/${encodeURIComponent(args.fieldId)}`)),
  );

  server.registerTool(
    'create_issue_field',
    {
      description:
        'Create a global issue field (admin). type is a class name like ' +
        '"ru.yandex.startrek.core.fields.StringFieldType" (also Date, DateTime, Text, Float, ' +
        'Integer, User, Uri, Money, TimeTrackingDuration, StringFieldType with container=true).',
      inputSchema: z.object({
        name: localized,
        id: z.string().describe('Field key, latin letters and digits'),
        category: z.string().describe('Category id (see get_issue_fields)'),
        type: z.string().describe('ru.yandex.startrek.core.fields.*FieldType'),
        optionsProvider: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Dropdown values: {"type": "FixedListOptionsProvider", "values": ["a", "b"]}'),
        order: z.number().optional(),
        description: z.string().optional(),
        readonly: z.boolean().optional(),
        visible: z.boolean().optional(),
        hidden: z.boolean().optional(),
        container: z.boolean().optional().describe('Multi-value field (string/user/dropdown only)'),
      }),
    },
    async (args) => runTool(async () => client.post('/fields', args)),
  );

  server.registerTool(
    'update_issue_field',
    {
      description:
        'Rename a global issue field and/or update its dropdown values, category, order, ' +
        'visibility (admin). Optimistic locking: pass the current field version.',
      inputSchema: z.object({
        fieldId: z.string().describe('Field key'),
        version: z.string().or(z.number()).describe('Current field version (optimistic lock)'),
        name: localized.optional(),
        category: z.string().optional(),
        order: z.number().optional(),
        description: z.string().optional(),
        readonly: z.boolean().optional(),
        hidden: z.boolean().optional(),
        visible: z.boolean().optional(),
        optionsProvider: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('New dropdown values: {"type": "FixedListOptionsProvider", "values": […]}'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { fieldId, version, ...body } = args;
        return client.patch(`/fields/${encodeURIComponent(fieldId)}`, body, { version });
      }),
  );

  server.registerTool(
    'create_issue_field_category',
    {
      description: 'Create an issue field category (admin).',
      inputSchema: z.object({
        name: localized,
        order: z.number().describe('Display weight'),
        description: z.string().optional(),
      }),
    },
    async (args) => runTool(async () => client.post('/fields/categories', args)),
  );

  server.registerTool(
    'update_issue_field_category',
    {
      description: 'Rename an issue field category, change its order (admin).',
      inputSchema: z.object({
        categoryId: z.string().or(z.number()),
        version: z.string().or(z.number()).optional().describe('Category version (optimistic lock)'),
        name: localized.optional(),
        order: z.number().optional(),
        description: z.string().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { categoryId, version, ...body } = args;
        return client.patch(`/fields/categories/${encodeURIComponent(String(categoryId))}`, body, {
          version,
        });
      }),
  );
}
