import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.log': 'text/plain',
};

function guessMime(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) {
    return 'application/octet-stream';
  }
  return MIME_TYPES[filePath.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

export function registerAttachmentTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'list_issue_attachments',
    {
      description: 'List files attached to an issue and its comments.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/issues/${encodeURIComponent(args.issueId)}/attachments`)),
  );

  server.registerTool(
    'upload_issue_attachment',
    {
      description:
        'Attach a local file to an issue. Max file size is 1024 Mbit. ' +
        'The file must exist on the machine where the MCP server runs.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        filePath: z.string().describe('Absolute or relative path to the file on disk'),
        filename: z
          .string()
          .optional()
          .describe('Custom name to store the file under (defaults to the original name)'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, filePath, filename } = args;
        const data = await readFile(filePath);
        const form = new FormData();
        form.append(
          'file',
          new Blob([new Uint8Array(data)], { type: guessMime(filePath) }),
          filename ?? basename(filePath),
        );
        return client.post(
          `/issues/${encodeURIComponent(issueId)}/attachments`,
          undefined,
          filename ? { filename } : undefined,
          form,
        );
      }),
  );

  server.registerTool(
    'delete_issue_attachment',
    {
      description: 'Delete an attached file from an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        attachmentId: z.string().describe('Attachment id (from list_issue_attachments)'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(
          `/issues/${encodeURIComponent(args.issueId)}/attachments/${encodeURIComponent(args.attachmentId)}`,
        ),
      ),
  );
}
