import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerCommentTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'add_comment',
    {
      description: 'Add a comment to an issue. Supports Yandex Flavored Markdown.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        text: z.string().describe('Comment text'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.post(`/issues/${encodeURIComponent(args.issueId)}/comments`, {
          text: args.text,
        }),
      ),
  );

  server.registerTool(
    'get_issue_comments',
    {
      description: 'List comments of an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...query } = args;
        return client.get(`/issues/${encodeURIComponent(issueId)}/comments`, query);
      }),
  );

  server.registerTool(
    'edit_comment',
    {
      description: 'Edit an existing comment text.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        commentId: z.string().describe('Comment id (numeric id or longId)'),
        text: z.string().describe('New comment text'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, commentId, text } = args;
        return client.patch(
          `/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
          { text },
        );
      }),
  );

  server.registerTool(
    'delete_comment',
    {
      description: 'Delete a comment from an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        commentId: z.string().describe('Comment id (numeric id or longId)'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(
          `/issues/${encodeURIComponent(args.issueId)}/comments/${encodeURIComponent(args.commentId)}`,
        ),
      ),
  );
}
