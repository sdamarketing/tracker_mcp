import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { TrackerClient } from '../client.js';
import { runTool, setIfDefined } from '../utils.js';

const issueFieldShape = {
  summary: z.string().optional().describe('Issue title/summary'),
  description: z.string().optional().describe('Issue description (YFM markup supported)'),
  type: z.string().optional().describe('Issue type key, id or name, e.g. "bug", "task"'),
  priority: z.string().optional().describe('Priority key, id or name, e.g. "blocker", "normal"'),
  assignee: z.string().optional().describe('Assignee login or user id'),
  author: z.string().optional().describe('Author login or user id'),
  parent: z.string().optional().describe('Parent issue key or id'),
  tags: z.array(z.string()).optional().describe('Issue tags'),
  followers: z.array(z.string()).optional().describe('Followers: logins or user ids'),
  components: z.array(z.string()).optional().describe('Queue component names or ids'),
  sprint: z.array(z.string()).optional().describe('Sprint ids'),
  affectedVersions: z.array(z.string()).optional().describe('Affected version names or ids'),
  fixVersions: z.array(z.string()).optional().describe('Fix version names or ids'),
  deadline: z.string().optional().describe('Deadline date, format YYYY-MM-DD'),
  startDate: z.string().optional().describe('Start date, format YYYY-MM-DD'),
  dueDate: z.string().optional().describe('Due date, format YYYY-MM-DD'),
  estimation: z
    .string()
    .optional()
    .describe('Estimate in ISO 8601 duration format, e.g. "P5DT1H" or "P2W"'),
  project: z.number().optional().describe('Primary project shortId'),
  unique: z
    .string()
    .optional()
    .describe('Value that must be unique across the organization (dedup guard)'),
  attachmentIds: z.array(z.number()).optional().describe('Temporary attachment ids to attach'),
};

const issueFieldSchema = {
  ...issueFieldShape,
  extraFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Arbitrary additional issue fields as a JSON object (global custom fields, ' +
      'queue local fields, or add/set/remove update commands like {"tags": {"add": ["x"]}}). ' +
      'Merged into the request body as-is.',
    ),
};

function buildIssueBody(args: Record<string, unknown>): Record<string, unknown> {
  const { extraFields, ...rest } = args;
  const body: Record<string, unknown> = {};
  setIfDefined(body, rest);
  if (extraFields) {
    Object.assign(body, extraFields);
  }
  return body;
}

const expandParam = z
  .string()
  .optional()
  .describe('Comma-separated extra data to include: "transitions", "attachments", "comments"');

const fieldsParam = z
  .string()
  .optional()
  .describe('Comma-separated list of issue fields to include in the response');

export function registerIssueTools(server: McpServer, client: TrackerClient): void {
  server.registerTool(
    'find_issues',
    {
      description:
        'Find issues in Yandex Tracker. Pass exactly ONE search parameter: ' +
        '"queue" (queue key), "keys" (list of issue keys), "filter" (field->value object), ' +
        '"query" (Tracker query language string, e.g. "Queue: TREK Assignee: me()"), ' +
        '"query2" (query language 2.0 object) or "filterId" (saved filter id). ' +
        'Supports pagination via perPage/page.',
      inputSchema: z.object({
        queue: z.string().optional().describe('Queue key, e.g. "TREK"'),
        keys: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe('Issue key or list of issue keys'),
        filter: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Filter object: field name -> value, e.g. {"queue": "TREK", "assignee": "user1"}'),
        filterId: z.number().optional().describe('Saved filter id'),
        query: z
          .string()
          .optional()
          .describe('Query in Tracker query language, e.g. \'Queue: TREK Resolution: empty()\''),
        query2: z.record(z.string(), z.unknown()).optional().describe('Query language 2.0 object'),
        order: z
          .string()
          .optional()
          .describe('Sort order (only with "filter"): [+/-]FIELD, e.g. "+updatedAt"'),
        scrollType: z
          .enum(['sorted', 'unsorted'])
          .optional()
          .describe(
            'Enable result scrolling for large sets: "sorted" keeps the order, ' +
            '"unsorted" is cheaper. First request only.',
          ),
        perScroll: z.number().optional().describe('Max issues per scroll page (default 100, max 1000)'),
        scrollTTLMillis: z.number().optional().describe('Scroll context lifetime, ms (default 60000)'),
        scrollId: z.string().optional().describe('Scroll page id from the previous response'),
        fields: fieldsParam,
        expand: expandParam,
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const {
          queue, keys, filter, filterId, query, query2, order,
          scrollType, perScroll, scrollTTLMillis, scrollId,
          ...params
        } = args;
        const body: Record<string, unknown> = {};
        const searchParams: Array<[string, unknown]> = [
          ['queue', queue],
          ['keys', keys],
          ['filter', filter],
          ['filterId', filterId],
          ['query', query],
          ['query2', query2],
        ];
        const searchParam = searchParams.find(([, value]) => value !== undefined);
        if (!searchParam) {
          throw new Error(
            'Provide one of: queue, keys, filter, filterId, query or query2.',
          );
        }
        body[searchParam[0]] = searchParam[1];
        if (order !== undefined) body.order = order;
        const scrolling =
          scrollType !== undefined || perScroll !== undefined || scrollTTLMillis !== undefined || scrollId !== undefined;
        if (scrolling) {
          const { data, headers } = await client.postWithHeaders<unknown[]>('/issues/_search', body, {
            ...params,
            scrollType,
            perScroll,
            scrollTTLMillis,
            scrollId,
          });
          const scrollInfo: Record<string, unknown> = {
            hint: 'Передайте scrollId (и scrollToken при наличии) в следующий вызов find_issues; по завершении вызовите release_search_scroll.',
            totalCount: headers['x-total-count'],
          };
          if (headers['x-scroll-id']) scrollInfo.scrollId = headers['x-scroll-id'];
          if (headers['x-scroll-token']) scrollInfo.scrollToken = headers['x-scroll-token'];
          return { _scroll: scrollInfo, issues: data };
        }
        return client.post<unknown[]>('/issues/_search', body, params);
      }),
  );

  server.registerTool(
    'count_issues',
    {
      description: 'Get the number of issues matching a filter or query.',
      inputSchema: z.object({
        queue: z.string().optional().describe('Queue key'),
        filter: z.record(z.string(), z.unknown()).optional().describe('Filter object'),
        query: z.string().optional().describe('Tracker query language string'),
      }),
    },
    async (args) =>
      runTool(async () => {
        if (!args.queue && !args.filter && !args.query) {
          throw new Error('Provide one of: queue, filter or query.');
        }
        return client.post<{ total: number }>('/issues/_count', args);
      }),
  );

  server.registerTool(
    'create_issue',
    {
      description:
        'Create a new issue in Yandex Tracker. Requires queue key and summary. ' +
        'Text fields support Yandex Flavored Markdown.',
      inputSchema: z.object({
        queue: z.string().describe('Queue key or id, e.g. "TREK"'),
        ...issueFieldSchema,
      }),
    },
    async (args) =>
      runTool(async () => {
        const { queue, ...rest } = args;
        const body = buildIssueBody(rest);
        body.queue = queue;
        return client.post('/issues', body);
      }),
  );

  server.registerTool(
    'get_issue',
    {
      description: 'Get issue parameters by key or id, e.g. "TREK-123".',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        expand: expandParam,
        fields: fieldsParam,
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/issues/${encodeURIComponent(args.issueId)}`, args),
      ),
  );

  server.registerTool(
    'edit_issue',
    {
      description:
        'Edit an existing issue (PATCH): only provided fields are changed. ' +
        'For array fields you may pass "add"/"remove"/"set"/"replace" commands via extraFields, ' +
        'e.g. extraFields={"tags": {"add": ["new-tag"]}}.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        ...issueFieldSchema,
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...rest } = args;
        const body = buildIssueBody(rest);
        if (Object.keys(body).length === 0) {
          throw new Error('Provide at least one field to change.');
        }
        return client.patch(`/issues/${encodeURIComponent(issueId)}`, body);
      }),
  );

  server.registerTool(
    'move_issue',
    {
      description:
        'Move an issue to a different queue. Components, versions and projects are cleared ' +
        'by default (use moveAllFields to keep them). Local fields of the old queue are removed.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        queue: z.string().describe('Target queue key'),
        moveAllFields: z
          .boolean()
          .optional()
          .describe('Keep versions/components/projects if they exist in the target queue'),
        initialStatus: z
          .boolean()
          .optional()
          .describe('Reset issue status to the initial status of the target queue'),
        notify: z.boolean().optional().describe('Notify users about the change'),
        expand: expandParam,
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...query } = args;
        return client.post(`/issues/${encodeURIComponent(issueId)}/_move`, undefined, query);
      }),
  );

  server.registerTool(
    'get_issue_transitions',
    {
      description:
        'List workflow transitions available for the issue (with target statuses). ' +
        'Use transition ids with execute_transition.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.get(`/issues/${encodeURIComponent(args.issueId)}/transitions`),
      ),
  );

  server.registerTool(
    'execute_transition',
    {
      description:
        'Move an issue to a new status by executing a workflow transition. ' +
        'First get available transitions via get_issue_transitions. ' +
        'Some transitions (e.g. "close") require a resolution via extraFields, e.g. {"resolution": "fixed"}.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        transitionId: z.string().describe('Transition id from get_issue_transitions'),
        comment: z.string().optional().describe('Comment to add with the transition'),
        extraFields: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Fields to set during the transition, e.g. {"resolution": "fixed"}'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, transitionId, comment, extraFields } = args;
        const body: Record<string, unknown> = {};
        if (comment !== undefined) body.comment = comment;
        if (extraFields) Object.assign(body, extraFields);
        return client.post(
          `/issues/${encodeURIComponent(issueId)}/transitions/${encodeURIComponent(transitionId)}/_execute`,
          body,
        );
      }),
  );

  server.registerTool(
    'get_issue_links',
    {
      description:
        'List links of an issue (related, dependent, subtask, duplicate, epic links). ' +
        'Pass perPage/page for the paginated variant.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        perPage: z.number().optional().describe('Results per page (enables paginated mode)'),
        page: z.number().optional().describe('Page number, default 1'),
        linkTypes: z
          .array(z.string())
          .optional()
          .describe('Filter by link type keys (paginated mode only)'),
        fields: z.string().optional().describe('Comma-separated issue fields (paginated mode only)'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, perPage, page, linkTypes, fields } = args;
        if (perPage !== undefined || page !== undefined) {
          const body: Record<string, unknown> = {};
          if (linkTypes) body.linkTypes = linkTypes;
          if (fields) body.fields = fields;
          return client.post(
            `/issues/${encodeURIComponent(issueId)}/links/_list`,
            body,
            { perPage, page },
          );
        }
        return client.get(`/issues/${encodeURIComponent(issueId)}/links`);
      }),
  );

  server.registerTool(
    'release_search_scroll',
    {
      description:
        'Free scroll-search resources when you stopped paging through a scrolled ' +
        'find_issues result. Body: {"<scrollId>": "<scrollToken>"} for every page you opened.',
      inputSchema: z.object({
        scrollTokens: z
          .record(z.string(), z.string())
          .describe('Map scrollId → scrollToken from find_issues responses'),
      }),
    },
    async (args) =>
      runTool(async () => client.post('/system/search/scroll/_clear', args.scrollTokens)),
  );

  server.registerTool(
    'create_issue_link',
    {
      description: 'Create a link between the current issue and another issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Current issue key or id'),
        relationship: z
          .enum([
            'relates',
            'is dependent by',
            'depends on',
            'is subtask for',
            'is parent task for',
            'duplicates',
            'is duplicated by',
            'is epic of',
            'has epic',
          ])
          .describe('Link type'),
        issue: z.string().describe('Key or id of the issue to link with'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...body } = args;
        return client.post(`/issues/${encodeURIComponent(issueId)}/links`, body);
      }),
  );

  server.registerTool(
    'delete_issue_link',
    {
      description: 'Delete a link between issues by link id (see get_issue_links).',
      inputSchema: z.object({
        issueId: z.string().describe('Current issue key or id'),
        linkId: z.string().describe('Link id from get_issue_links'),
      }),
    },
    async (args) =>
      runTool(async () =>
        client.delete(`/issues/${encodeURIComponent(args.issueId)}/links/${encodeURIComponent(args.linkId)}`),
      ),
  );

  server.registerTool(
    'get_issue_changelog',
    {
      description: 'Get the change history (changelog) of an issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue key or id'),
        perPage: z.number().optional().describe('Results per page, default 50'),
        page: z.number().optional().describe('Page number, default 1'),
      }),
    },
    async (args) =>
      runTool(async () => {
        const { issueId, ...query } = args;
        return client.get(`/issues/${encodeURIComponent(issueId)}/changelog`, query);
      }),
  );
}
