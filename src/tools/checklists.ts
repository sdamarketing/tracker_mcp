import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool } from '../utils.js';

interface ChecklistItemResponse {
  id: string;
  text?: string;
  checked?: boolean;
  assignee?: unknown;
  deadline?: { date: string; deadlineType: string };
  checklistItemType?: string;
}

export function registerChecklistTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'get_checklist',
    {
      description: 'Get the checklist of an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get<ChecklistItemResponse[]>(
          `/issues/${encodeURIComponent(args.issueId)}/checklistItems`,
        ),
      ),
  );

  server.registerTool(
    'add_checklist_item',
    {
      description: 'Add a checklist item to an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        text: z.string().describe('Checklist item text'),
        checked: z.boolean().optional().describe('Mark item as done'),
        assignee: z.string().optional().describe('Assignee login or user id'),
        deadlineDate: z
          .string()
          .optional()
          .describe('Item deadline, format YYYY-MM-DDThh:mm:ss.sss±hhmm'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, text, checked, assignee, deadlineDate } = args;
        const body: Record<string, unknown> = { text };
        if (checked !== undefined) body.checked = checked;
        if (assignee !== undefined) body.assignee = assignee;
        if (deadlineDate !== undefined) {
          body.deadline = { date: deadlineDate, deadlineType: 'date' };
        }
        return client.post(`/issues/${encodeURIComponent(issueId)}/checklistItems`, body);
      }),
  );

  server.registerTool(
    'edit_checklist_item',
    {
      description:
        'Edit a single checklist item. The Tracker API requires the full item list in the ' +
        'request body, so this tool fetches the current checklist, merges your change into the ' +
        'target item, and sends the whole list back.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        itemId: z.string().describe('Checklist item id (from get_checklist)'),
        text: z.string().optional().describe('New item text'),
        checked: z.boolean().optional().describe('Mark item as done / undone'),
        assignee: z.string().optional().describe('Assignee login or user id'),
        deadlineDate: z
          .string()
          .optional()
          .describe('Item deadline, format YYYY-MM-DDThh:mm:ss.sss±hhmm'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, itemId, text, checked, assignee, deadlineDate } = args;
        const issuePath = `/issues/${encodeURIComponent(issueId)}`;
        const items = await client.get<ChecklistItemResponse[]>(`${issuePath}/checklistItems`);
        const target = items.find((item) => item.id === itemId);
        if (!target) {
          throw new Error(
            `Checklist item ${itemId} not found in ${issueId}. Available ids: ` +
            items.map((item) => item.id).join(', '),
          );
        }
        // The API requires the full item list in the PATCH body.
        const body = items.map((item) => {
          const itemBody: Record<string, unknown> = { text: item.text ?? '' };
          if (item.checked !== undefined) {
            itemBody.checked = item.checked;
          }
          if (item.deadline) {
            itemBody.deadline = item.deadline;
          }
          const itemAssignee = item.assignee as { login?: string; id?: number } | undefined;
          if (itemAssignee) {
            itemBody.assignee = itemAssignee.login ?? itemAssignee.id;
          }
          if (item.id === itemId) {
            if (text !== undefined) itemBody.text = text;
            if (checked !== undefined) itemBody.checked = checked;
            if (assignee !== undefined) itemBody.assignee = assignee;
            if (deadlineDate !== undefined) {
              itemBody.deadline = { date: deadlineDate, deadlineType: 'date' };
            }
          }
          return itemBody;
        });
        return client.patch(`${issuePath}/checklistItems/${encodeURIComponent(itemId)}`, body);
      }),
  );

  server.registerTool(
    'delete_checklist',
    {
      description: 'Delete the whole checklist of an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(`/issues/${encodeURIComponent(args.issueId)}/checklistItems`),
      ),
  );

  server.registerTool(
    'delete_checklist_item',
    {
      description: 'Delete a checklist item from an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        itemId: z.string().describe('Checklist item id (from get_checklist)'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(
          `/issues/${encodeURIComponent(args.issueId)}/checklistItems/${encodeURIComponent(args.itemId)}`,
        ),
      ),
  );
}
