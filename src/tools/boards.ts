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
}
