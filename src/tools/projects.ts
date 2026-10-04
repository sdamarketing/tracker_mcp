import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

export function registerProjectTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_projects',
    {
      description: 'List all projects of the organization.',
      inputSchema: z.object({
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) => runTool(async () => client.get('/projects', args)),
  );

  server.registerTool(
    'get_project',
    {
      description: 'Get project parameters by id.',
      inputSchema: z.object({
        projectId: z.string().describe('Project id'),
      }),
    },
    async (args) =>
      runTool(async () => client.get(`/projects/${encodeURIComponent(args.projectId)}`)),
  );

  server.registerTool(
    'create_project',
    {
      description: 'Create a project.',
      inputSchema: z.object({
        name: z.string().describe('Project name'),
        queues: z
          .array(z.string())
          .optional()
          .describe('Queue keys whose issues are included in the project'),
        description: z.string().optional().describe('Project description'),
        lead: z.string().optional().describe('Project lead login or user id'),
        startDate: z.string().optional().describe('Start date, format YYYY-MM-DD'),
        endDate: z.string().optional().describe('Deadline date, format YYYY-MM-DD'),
        tags: z.array(z.string()).optional().describe('Project tags'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const body: Record<string, unknown> = { ...args };
        return client.post('/projects', body);
      }),
  );

  server.registerTool(
    'update_project',
    {
      description: 'Update project parameters.',
      inputSchema: z.object({
        projectId: z.string().describe('Project id'),
        name: z.string().optional().describe('New project name'),
        description: z.string().optional().describe('New project description'),
        lead: z.string().optional().describe('New project lead login or user id'),
        startDate: z.string().optional().describe('Start date, format YYYY-MM-DD'),
        endDate: z.string().optional().describe('Deadline date, format YYYY-MM-DD'),
        tags: z.array(z.string()).optional().describe('New project tags'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { projectId, ...body } = args;
        return client.patch(`/projects/${encodeURIComponent(projectId)}`, body);
      }),
  );

  server.registerTool(
    'get_project_queues',
    {
      description: 'List queues whose issues are included in a project.',
      inputSchema: z.object({
        projectId: z.string().or(z.number()),
        expand: z
          .string()
          .optional()
          .describe('Comma-separated: all, projects, components, versions, types, team, workflows, fields'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(
          `/projects/${encodeURIComponent(String(args.projectId))}/queues`,
          args.expand ? { expand: args.expand } : undefined,
        ),
      ),
  );

  server.registerTool(
    'delete_project',
    {
      description: 'Delete a project by id. Issues are not deleted.',
      inputSchema: z.object({
        projectId: z.string().describe('Project id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(`/projects/${encodeURIComponent(args.projectId)}`),
      ),
  );
}
