import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerBoardTools(server: McpServer, client: TrackerClient): void {
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
