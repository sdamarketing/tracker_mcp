import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerBoardTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'create_board',
    {
      description:
        'Create a new task board (via the liveBoards API; the legacy POST /boards ignores ' +
        'body parameters). Columns map board columns to issue status keys.',
      inputSchema: z.object({
        name: z.string().describe('Board name'),
        owner: z.string().optional().describe('Owner login or uid'),
        boardPermissionsTemplate: z
          .enum(['private', 'public'])
          .optional()
          .describe('Access template: "private" (owner only) or "public" (default)'),
        backlogAvailable: z.boolean().optional().describe('Enable backlog on the board'),
        sprintsAvailable: z.boolean().optional().describe('Enable sprints on the board'),
        columns: z
          .array(
            z.object({
              name: z.string().describe('Column name'),
              statuses: z
                .array(z.string())
                .describe('Status keys/names displayed in this column'),
              limit: z.number().optional().describe('WIP limit for the column'),
            }),
          )
          .optional()
          .describe('Board columns; omit to use default columns'),
        autoFilters: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Auto add/remove filter, e.g. {"addFilter": {"liveFilter": {"fieldValues": ' +
            '{"queue": [{"fixed": "KEY"}]}}, "enabled": true}}',
          ),
      }),
    },
    async (args) => runTool(async () => client.post('/liveBoards', args)),
  );

  server.registerTool(
    'get_boards',
    {
      description: 'List all issue boards of the organization.',
      inputSchema: z.object({
        perPage: z.number().optional().describe('Results per page, default 50'),
      }),
    },
    async (args) => runTool(async () => client.get('/boards', args)),
  );

  server.registerTool(
    'get_board',
    {
      description: 'Get board parameters by id, including its columns.',
      inputSchema: z.object({
        boardId: z.number().describe('Board id (from get_boards)'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/boards/${encodeURIComponent(args.boardId)}`)),
  );

  server.registerTool(
    'get_board_columns',
    {
      description: 'List columns of a board.',
      inputSchema: z.object({
        boardId: z.number().describe('Board id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/boards/${encodeURIComponent(args.boardId)}/columns`)),
  );

  server.registerTool(
    'get_board_sprints',
    {
      description: 'List sprints of a board (agile boards only).',
      inputSchema: z.object({
        boardId: z.number().describe('Board id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/boards/${encodeURIComponent(args.boardId)}/sprints`)),
  );

  server.registerTool(
    'get_boards_paginate',
    {
      description:
        'List boards with relative pagination (for more than one page): pass the last ' +
        'board id as "id" to get the next page. Max 500 per page.',
      inputSchema: z.object({
        perPage: z.number().max(500).optional(),
        id: z.number().optional().describe('Board id to start from (previous page last id)'),
      }),
    },
    async (args) => runTool(async () => client.get('/boards/_paginate', args)),
  );

  server.registerTool(
    'update_board',
    {
      description:
        'Update a board: name, backlog/sprints toggles, columns (with status mapping). ' +
        'Board owner cannot be changed via API.',
      inputSchema: z.object({
        boardId: z.number(),
        name: z.string().optional(),
        backlogAvailable: z.boolean().optional().describe('Must equal sprintsAvailable'),
        sprintsAvailable: z.boolean().optional().describe('Must equal backlogAvailable'),
        columns: z
          .array(z.object({ name: z.string(), statuses: z.array(z.string()), limit: z.number().optional() }))
          .optional(),
        backlogColumns: z.array(z.object({ name: z.string(), limit: z.number().optional() })).optional(),
        nonParametrizedColumns: z.array(z.object({ name: z.string(), limit: z.number().optional() })).optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { boardId, ...body } = args;
        return client.patch(`/boards/${boardId}`, body);
      }),
  );

  server.registerTool(
    'delete_board',
    {
      description: 'Delete a board by id.',
      inputSchema: z.object({ boardId: z.number() }),
    },
    async (args) => runTool(async () => client.delete(`/boards/${args.boardId}`)),
  );

  server.registerTool(
    'get_board_column',
    {
      description: 'Get parameters of one board column.',
      inputSchema: z.object({ boardId: z.number(), columnId: z.number() }),
    },
    async (args) =>
      runTool(async () => client.get(`/boards/${args.boardId}/columns/${args.columnId}`)),
  );

  server.registerTool(
    'create_board_column',
    {
      description:
        'Create a column on a board. version = current board version (If-Match lock; ' +
        'get it from get_board).',
      inputSchema: z.object({
        boardId: z.number(),
        name: z.string(),
        statuses: z.array(z.string()).describe('Status keys shown in the column'),
        version: z.string().or(z.number()).describe('Current board version'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { boardId, version, ...body } = args;
        return client.post(`/boards/${boardId}/columns`, body, undefined, undefined, version);
      }),
  );

  server.registerTool(
    'update_board_column',
    {
      description: 'Rename a board column or change its statuses (version = board version).',
      inputSchema: z.object({
        boardId: z.number(),
        columnId: z.number(),
        name: z.string().optional(),
        statuses: z.array(z.string()).optional(),
        version: z.string().or(z.number()).describe('Current board version'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { boardId, columnId, version, ...body } = args;
        return client.patch(`/boards/${boardId}/columns/${columnId}`, body, undefined, version);
      }),
  );

  server.registerTool(
    'delete_board_column',
    {
      description: 'Delete a board column (version = board version).',
      inputSchema: z.object({
        boardId: z.number(),
        columnId: z.number(),
        version: z.string().or(z.number()).describe('Current board version'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { boardId, columnId, version } = args;
        return client.delete(`/boards/${boardId}/columns/${columnId}`, undefined, version);
      }),
  );

  // --- Спринты (доски с включёнными спринтами) -------------------------------------

  server.registerTool(
    'get_sprint',
    {
      description: 'Get sprint parameters by id.',
      inputSchema: z.object({ sprintId: z.string().or(z.number()) }),
    },
    async (args) =>
      runTool(async () => client.get(`/sprints/${encodeURIComponent(String(args.sprintId))}`)),
  );

  server.registerTool(
    'create_sprint',
    {
      description: 'Create a sprint on a board (the board must have sprints enabled).',
      inputSchema: z.object({
        boardId: z.number().or(z.string()).describe('Board id'),
        name: z.string(),
        startDate: z.string().describe('YYYY-MM-DD'),
        endDate: z.string().describe('YYYY-MM-DD'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.post('/sprints', {
          name: args.name,
          board: { id: String(args.boardId) },
          startDate: args.startDate,
          endDate: args.endDate,
        }),
      ),
  );

  server.registerTool(
    'update_sprint',
    {
      description:
        'Rename a sprint, change dates or status (version = sprint version, If-Match lock).',
      inputSchema: z.object({
        sprintId: z.string().or(z.number()),
        name: z.string().optional(),
        startDate: z.string().optional().describe('YYYY-MM-DD'),
        endDate: z.string().optional().describe('YYYY-MM-DD'),
        status: z.enum(['draft', 'in_progress', 'released', 'archived']).optional(),
        version: z.string().or(z.number()).describe('Current sprint version'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { sprintId, version, ...body } = args;
        return client.patch(
          `/sprints/${encodeURIComponent(String(sprintId))}`,
          body,
          undefined,
          version,
        );
      }),
  );

  server.registerTool(
    'start_sprint',
    {
      description: 'Start a sprint (moves to in_progress; version = sprint version).',
      inputSchema: z.object({
        sprintId: z.string().or(z.number()),
        version: z.string().or(z.number()).describe('Current sprint version'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { sprintId, version } = args;
        return client.post(
          `/sprints/${encodeURIComponent(String(sprintId))}/_start`,
          undefined,
          undefined,
          undefined,
          version,
        );
      }),
  );

  server.registerTool(
    'archive_sprint',
    {
      description: 'Archive a finished sprint (version = sprint version).',
      inputSchema: z.object({
        sprintId: z.string().or(z.number()),
        version: z.string().or(z.number()).describe('Current sprint version'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { sprintId, version } = args;
        return client.post(
          `/sprints/${encodeURIComponent(String(sprintId))}/_archive`,
          undefined,
          undefined,
          undefined,
          version,
        );
      }),
  );

  server.registerTool(
    'delete_sprint',
    {
      description: 'Delete a sprint by id.',
      inputSchema: z.object({ sprintId: z.string().or(z.number()) }),
    },
    async (args) =>
      runTool(async () => client.delete(`/sprints/${encodeURIComponent(String(args.sprintId))}`)),
  );
}
