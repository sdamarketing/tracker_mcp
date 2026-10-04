import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerExternalLinkTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_external_applications',
    {
      description: 'List external applications available for issue external links.',
      inputSchema: z.object({}),
    },
    async () => runTool(async () => client.get('/applications')),
  );

  server.registerTool(
    'get_external_links',
    {
      description: 'List external application links of an issue.',
      inputSchema: z.object({ issueId: z.string().describe('Issue key or id') }),
    },
    async (args) =>
      runTool(async () => client.get(`/issues/${encodeURIComponent(args.issueId)}/remotelinks`)),
  );

  server.registerTool(
    'create_external_link',
    {
      description:
        'Link an issue to an object in an external application (e.g. Jira via a connector). ' +
        'Use relationship "RELATES" unless the app docs say otherwise.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        relationship: z.string().describe('Link type, usually "RELATES"'),
        key: z.string().describe('Object key in the external application'),
        origin: z.string().describe('Application id from get_external_applications'),
        backlink: z
          .boolean()
          .optional()
          .describe('Also create a backlink in the external app'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, backlink, ...body } = args;
        return client.post(
          `/issues/${encodeURIComponent(issueId)}/remotelinks`,
          body,
          backlink !== undefined ? { backlink } : undefined,
        );
      }),
  );

  server.registerTool(
    'delete_external_link',
    {
      description: 'Delete an external application link of an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        linkId: z.string().describe('Link id from get_external_links'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(
          `/issues/${encodeURIComponent(args.issueId)}/remotelinks/${encodeURIComponent(args.linkId)}`,
        ),
      ),
  );
}
