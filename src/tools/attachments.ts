import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool, imageResult, textResult, jsonResult } from '../utils.js';

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

/** Бинарный ответ как инструмент: картинки — image-контентом, текст — как текст, прочее — base64. */
function binaryToolResult(buffer: Buffer, contentType: string) {
  if (contentType.startsWith('image/') && buffer.length <= 5 * 1024 * 1024) {
    return imageResult(buffer, contentType);
  }
  if (
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('csv')
  ) {
    const text = buffer.toString('utf8');
    return textResult(
      text.length > 200_000
        ? text.slice(0, 200_000) + '\n… (обрезано: файл больше 200 000 символов)'
        : text,
    );
  }
  if (buffer.length > 8 * 1024 * 1024) {
    return textResult(`Файл ${buffer.length} байт (${contentType}) — слишком большой для передачи. Размер > 8 МБ.`);
  }
  return jsonResult({
    note: 'Binary content, base64-encoded',
    contentType,
    size: buffer.length,
    base64: buffer.toString('base64'),
  });
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
    'get_issue_attachment',
    {
      description: 'Get metadata of one attached file (name, size, mime type).',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        attachmentId: z.string().or(z.number()).describe('Attachment id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/issues/${encodeURIComponent(args.issueId)}/attachments/${encodeURIComponent(String(args.attachmentId))}`,
        ),
      ),
  );

  server.registerTool(
    'download_issue_attachment',
    {
      description:
        'Download attachment content: images come back as image content (visible in chat), ' +
        'text files as text, other binaries as base64. Omit filename to auto-resolve it by id.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        attachmentId: z.string().or(z.number()).describe('Attachment id'),
        filename: z.string().optional().describe('Stored file name (auto-resolved if omitted)'),
      }),
    },
    async (args) => {
      try {
        const pathBase = `/issues/${encodeURIComponent(args.issueId)}/attachments/${encodeURIComponent(String(args.attachmentId))}`;
        let filename = args.filename;
        if (!filename) {
          const info = await client.get<{ name?: string }>(pathBase);
          filename = info.name ?? 'file';
        }
        const { buffer, contentType } = await client.download(`${pathBase}/${encodeURIComponent(filename)}`);
        return binaryToolResult(buffer, contentType);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return textResult(message);
      }
    },
  );

  server.registerTool(
    'get_attachment_thumbnail',
    {
      description: 'Download the preview thumbnail of an attached image (image content).',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        attachmentId: z.string().or(z.number()).describe('Attachment id'),
      }),
    },
    async (args) => {
      try {
        const { buffer, contentType } = await client.download(
          `/issues/${encodeURIComponent(args.issueId)}/thumbnails/${encodeURIComponent(String(args.attachmentId))}`,
        );
        return imageResult(buffer, contentType.startsWith('image/') ? contentType : 'image/png');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return textResult(message);
      }
    },
  );

  server.registerTool(
    'upload_temp_attachment',
    {
      description:
        'Upload a temporary file (not yet attached anywhere). Returns a temp id usable once ' +
        'in create_issue attachmentIds, add_comment attachmentIds and entity attachments.',
      inputSchema: z.object({
        filePath: z.string().describe('Path to the file on this machine'),
        filename: z.string().optional().describe('Server-side name override'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { filePath, filename } = args;
        const data = await readFile(filePath);
        const form = new FormData();
        form.append(
          'file',
          new Blob([new Uint8Array(data)], { type: guessMime(filePath) }),
          filename ?? basename(filePath),
        );
        return client.post('/attachments', undefined, filename ? { filename } : undefined, form);
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
