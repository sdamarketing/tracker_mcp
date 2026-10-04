import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

/**
 * Импорт — миграционные эндпоинты (только администраторы): создают сущности
 * с заданными датами и авторами «задним числом». Используйте при переезде
 * из другого трекера, не для повседневной работы.
 */
export function registerImportTools(server: McpServer, client: TrackerClient): void {
  const timestamp = z
    .string()
    .describe('YYYY-MM-DDThh:mm:ss.sss±hhmm, not in the future');

  server.registerTool(
    'import_issue',
    {
      description:
        'MIGRATION (admin): create an issue with a custom author and creation date. ' +
        'Use only when migrating from another tracker.',
      inputSchema: z.object({
        queue: z.string(),
        summary: z.string().max(255),
        createdAt: timestamp,
        createdBy: z.string().or(z.number()).describe('Author login or id'),
        key: z.string().optional().describe('Custom issue key'),
        status: z.number().optional().describe('Status id'),
        type: z.number().optional().describe('Issue type id'),
        priority: z.number().optional().describe('Priority id'),
        resolution: z.number().optional().describe('Resolution id (with resolvedAt/By)'),
        resolvedAt: z.string().optional(),
        resolvedBy: z.string().or(z.number()).optional(),
        updatedAt: z.string().optional(),
        updatedBy: z.string().or(z.number()).optional(),
        assignee: z.string().or(z.number()).optional(),
        description: z.string().optional(),
        deadline: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        tags: z.array(z.string()).optional(),
        followers: z.array(z.string().or(z.number())).optional(),
        unique: z.string().optional(),
        originalEstimation: z.number().optional().describe('Milliseconds'),
        estimation: z.number().optional().describe('Milliseconds'),
        spent: z.number().optional().describe('Milliseconds'),
        storyPoints: z.number().optional(),
      }),
    },
    async (args) => runTool(async () => client.post('/issues/_import', args)),
  );

  server.registerTool(
    'import_issue_comment',
    {
      description: 'MIGRATION (admin): add a comment with a custom author and date.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        text: z.string().max(512000),
        createdAt: z.string().describe('Within the issue create→last-update window'),
        createdBy: z.string().or(z.number()),
        updatedAt: z.string().optional(),
        updatedBy: z.string().or(z.number()).optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...body } = args;
        return client.post(`/issues/${encodeURIComponent(issueId)}/comments/_import`, body);
      }),
  );

  server.registerTool(
    'import_issue_link',
    {
      description:
        'MIGRATION (admin): create an issue link with a custom author and date. ' +
        'Supports all relationship types plus "clone" and "original".',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        relationship: z.string(),
        issue: z.string().describe('Linked issue key or id'),
        createdAt: z.string(),
        createdBy: z.string().or(z.number()),
        updatedAt: z.string().optional(),
        updatedBy: z.string().or(z.number()).optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...body } = args;
        return client.post(`/issues/${encodeURIComponent(issueId)}/links/_import`, body);
      }),
  );

  server.registerTool(
    'import_worklog_record',
    {
      description: 'MIGRATION (admin): add a worklog record with a custom author and date.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        duration: z.string().describe('ISO 8601, e.g. "PT2H30M"'),
        start: z.string(),
        createdAt: z.string(),
        createdBy: z.string().or(z.number()),
        comment: z.string().optional(),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...body } = args;
        return client.post(`/issues/${encodeURIComponent(issueId)}/worklogs/_import`, body);
      }),
  );

  server.registerTool(
    'import_issue_attachment',
    {
      description:
        'MIGRATION (admin): attach a local file with a custom author and date, ' +
        'to an issue or to one of its comments.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        filePath: z.string().describe('Path to the file on this machine'),
        createdAt: z.string().describe('Between issue creation and last update'),
        createdBy: z.string(),
        filename: z.string().optional().describe('Stored name (defaults to the original)'),
        commentId: z.string().optional().describe('Attach to this comment instead of the issue'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, filePath, filename, commentId, ...query } = args;
        const data = await readFile(filePath);
        const form = new FormData();
        form.append('file_data', new Blob([new Uint8Array(data)]), basename(filePath));
        const base = commentId
          ? `/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/attachments/_import`
          : `/issues/${encodeURIComponent(issueId)}/attachments/_import`;
        return client.post(base, undefined, {
          ...query,
          filename: filename ?? basename(filePath),
        }, form);
      }),
  );
}
