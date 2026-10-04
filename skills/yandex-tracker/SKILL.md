---
name: yandex-tracker
description: Work with Yandex Tracker through the yandex-tracker MCP server (traker-mcp) — search issues with the Tracker query language, create/edit/transition issues with valid field values, manage checklists, comments, worklog, links, bulk changes, queues, boards, dashboards, projects, portfolios and goals. Use when the user mentions Yandex Tracker, Трекер, задачи/очереди/доски/проекты/цели, issue keys like KEY-123, or asks to find/create/update/close/assign issues, check statuses, or plan work in Tracker.
---

# Yandex Tracker via traker-mcp

All interaction goes through MCP tools from the `yandex-tracker` server
(github.com/sdamarketing/tracker_mcp). If the tools are not available, help the
user install the server first:

```bash
curl -fsSL https://raw.githubusercontent.com/sdamarketing/tracker_mcp/main/install.sh | bash
```

## Tool map (71 tools)

| Task | Tools |
|---|---|
| Search / count | `find_issues`, `count_issues` |
| Issue lifecycle | `create_issue`, `get_issue`, `edit_issue`, `move_issue` |
| Statuses | `get_issue_transitions`, `execute_transition` |
| Links | `get_issue_links`, `create_issue_link`, `delete_issue_link` |
| Comments / checklist / time | `add_comment`, `get_issue_comments`, `get_checklist`, `add_checklist_item`, `edit_checklist_item`, `add_worklog_record` |
| Files | `list_issue_attachments`, `upload_issue_attachment` |
| Bulk | `bulk_update_issues`, `bulk_move_issues`, `bulk_transition_issues`, `get_bulk_operation_info` |
| Queues | `get_queues`, `get_queue`, `get_queue_fields`, `create_queue`, `create_queue_version`, `create_component` |
| Boards / dashboards | `get_boards`, `get_board`, `create_board`, `create_dashboard`, `create_cycle_time_widget` |
| Projects / goals | `create_project`, `search_entities`, `get_entity`, `create_entity`, `update_entity`, `add_entity_comment` |
| Catalogs & users | `get_current_user`, `get_user`, `get_statuses`, `get_priorities`, `get_resolutions`, `get_issue_types`, `get_issue_fields` |

## Core rules

1. **Use keys, not names, for field values**: statuses (`open`, `closed`),
   priorities (`critical`), resolutions (`fixed`), issue types (`task`, `bug`).
   Organizations define custom values — when in doubt or on a 400 error, call
   the catalog tools (`get_priorities`, `get_statuses`, `get_resolutions`,
   `get_issue_types`) and retry with real keys. Never guess priority keys:
   common orgs have `trivial minor normal critical blocker`, some add
   `minimal`/`important` — there is no universal `major`.
2. **Search takes exactly one source**: per `find_issues` call pass one of
   `queue`, `keys`, `filter`, `filterId`, `query`, `query2`. They are not
   combined; priority order is queue > keys > filter > query.
3. **Dates** are `YYYY-MM-DD`; **durations** are ISO 8601 (`PT2H30M`, `P3D`,
   `P1WT4H`). Tracker counts time in 5-day work weeks / 8-hour days, so `P5D`
   shows as 1 week.
4. **Markdown**: issue descriptions, comments and entity descriptions support
   Yandex Flavored Markdown (`**bold**`, lists, ```code```).
5. **Rights mirror the UI**: the token acts as its user. A 403 means the user
   really lacks access — say so instead of retrying.
6. **IAM tokens live ≤ 12 hours**: on 401 with `Bearer` auth, tell the user to
   issue a fresh IAM token and update the client config (`.env` or the MCP
   client's environment block). OAuth tokens (`y0__…`) don't expire like that.

## Recipes

### Find issues

```
find_issues { query: 'Queue: TREK Assignee: me() Resolution: empty()' }
find_issues { filter: { queue: 'TREK', status: 'open' }, order: '+updatedAt', perPage: 50, page: 1 }
count_issues { query: 'Queue: TREK Assignee: me()' }   // cheap pre-count
```

Query-language sort goes inside `query`: `'Queue: TREK "Sort by": Updated DESC'`.
See [references/query-language.md](references/query-language.md) for the full
syntax. For a queue dump prefer `filter` + pagination (`perPage` default 50).

### Create an issue

```
create_issue {
  queue: 'TREK',                      // case-sensitive key, not the name
  summary: 'Fix login page crash',
  description: 'Steps: **1.** open /login …',
  type: 'bug', priority: 'critical',   // keys from get_issue_types/get_priorities
  assignee: 'user-login',
  tags: ['backend'],
}
```

Before creating in an unfamiliar queue, call `get_queue_fields` — it returns
required fields and allowed values, including queue-local custom fields
(ids like `<queue-id>--fieldname`). Pass custom fields through `extraFields`.

Subtasks: pass `parent: 'TREK-12'` at creation, or link afterwards:

```
create_issue_link { issueId: 'TREK-13', relationship: 'is subtask for', issue: 'TREK-12' }
```

Valid relationships: `relates`, `depends on`, `is dependent by`,
`is subtask for`, `is parent task for`, `duplicates`, `is duplicated by`,
`is epic of`, `has epic`.

### Change status (transition)

Never set status directly. List the workflow transitions first, then execute:

```
get_issue_transitions { issueId: 'TREK-1' }
execute_transition {
  issueId: 'TREK-1',
  transitionId: 'close',
  extraFields: { resolution: 'fixed' },   // closing usually REQUIRES a resolution
  comment: 'Fixed in 1.2.3',
}
```

Transitions depend on the queue's workflow (e.g. `start_progress`, `resolve`,
`need_info`, `in_review`, `close`, `wont_fix`). If `execute_transition`
returns 400, the transition screen requires more fields — read the error, it
names every missing field.

### Edit issues and bulk changes

```
edit_issue   { issueId: 'TREK-1', extraFields: { tags: { add: ['urgent'] } } }
bulk_update_issues { issues: ['TREK-1', 'TREK-2'], values: { priority: 'blocker' } }
bulk_transition_issues { issues: ['TREK-1'], transition: 'close', values: { resolution: 'fixed' } }
```

Array fields support `add` / `remove` / `set` / `replace` commands in
`extraFields`/`values`. Bulk `issues` also accepts a query-language string.
Long bulk operations are async — poll `get_bulk_operation_info` with the
returned id.

### Checklist, worklog, comment

```
add_checklist_item { issueId: 'TREK-1', text: 'Repro on staging' }
edit_checklist_item { issueId: 'TREK-1', itemId: '…', checked: true }  // full-list merge is handled by the tool
add_worklog_record { issueId: 'TREK-1', start: '2026-10-04T12:00:00.000+0000', duration: 'PT45M' }
add_comment { issueId: 'TREK-1', text: 'Deployed' }
```

### Queues, versions, components

```
get_queues {}                          // find the right queue key first
create_queue_version { queueId: 'TREK', name: 'v2.0', dueDate: '2026-12-31' }
create_component { name: 'Billing', queue: 'TREK' }
```

Queue keys are uppercase Latin and case-sensitive everywhere.

### Projects, portfolios, goals (entities)

`entityType` is `project` | `portfolio` | `goal`; all entity fields go in the
`fields` object (the tool wraps them for the API):

```
search_entities { entityType: 'goal', input: 'выручка' }
create_entity { entityType: 'goal', summary: 'Automate Tracker', fields: { end: '2026-12-31' } }
update_entity { entityType: 'project', entityId: '…', fields: { parentEntity: { primary: '<portfolio-id>', secondary: [] } } }
```

Entity statuses: projects/portfolios `draft, in_progress, according_to_plan,
postponed, at_risk, blocked, launched, cancelled`; goals `draft,
according_to_plan, at_risk, blocked, achieved, partially_achieved,
not_achieved, exceeded, cancelled`. `search_entities` returns `id`/`shortId` —
`get_entity`/`update_entity` need the string `id`.

### Boards and dashboards

```
get_statuses {}                       // column statuses must be real keys
create_board { name: 'Dev board', columns: [ { name: 'To Do', statuses: ['open'] },
  { name: 'In Progress', statuses: ['inProgress'] } ] }
create_dashboard { name: 'Team dashboard', layout: 'two-columns' }
create_cycle_time_widget { dashboardId: 7, description: 'Cycle time TREK', query: 'Queue: TREK', fromStatuses: [{ key: 'open' }], toStatuses: [{ key: 'closed' }] }
```

## Pitfalls (verified against the live API)

- `create_queue_version` — the date field is **`dueDate`**, not `releaseDate`.
- Closing transitions without a resolution → 400. Add `resolution` to
  `extraFields`/`values`.
- `find_issues` with two search params silently uses the higher-priority one;
  three or more → 400 «only keys, queue or query».
- 403 «Organization is not available, not ready or not found» → wrong
  `TRACKER_ORG_ID` or Tracker not enabled for the org — fix credentials,
  don't retry.
- 401 → bad or expired token (IAM ≤12h). Suggest re-running setup:
  `cd ~/.traker-mcp && npm run setup`.
- Comments and issue text use YFM; raw HTML is not rendered.
- Moving an issue to another queue clears components/versions/projects unless
  `moveAllFields: true`, and drops old-queue local fields.
- The API works in UTC: created/updated timestamps come back UTC±00:00.

## References

- [query-language.md](references/query-language.md) — full Tracker query
  language and filter recipes.
- [field-catalogs.md](references/field-catalogs.md) — standard catalogs and
  how to discover org-specific values.
