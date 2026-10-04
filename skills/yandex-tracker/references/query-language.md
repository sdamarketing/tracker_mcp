# Tracker query language and filters

Two search styles, both supported by `find_issues` / `count_issues`:

- `query` — Tracker query language string (supports sort, functions, OR).
- `filter` — exact field-value object (combined with `order: '+field'`).

Pick one per call; `queue`, `keys`, `filterId`, `query2` are other valid
sources.

## Query language essentials

Field-value pairs, space-separated:

```
Queue: TREK Assignee: me() Resolution: empty()
```

- Field names accept Russian UI names too: `Очередь: TREK Исполнитель: me()`.
- Values with spaces go in quotes: `Summary: "login crash"`.
- Sort: append `"Sort by": Updated DESC` (or `Created ASC`).
- Negation: `Queue: not TREK`; functions `empty()` / `notEmpty()`.

## Useful functions

| Function | Meaning |
|---|---|
| `me()` | current user (Assignee: me(), Author: me()) |
| `empty()` | field is empty (Resolution: empty() = unresolved) |
| `notEmpty()` | field is set |

## Field keys commonly used in queries

`Queue`, `Summary`, `Description`, `Assignee`, `Author`, `Status`,
`Resolution`, `Type`, `Priority`, `Tags`, `Components`, `Sprint`,
`Affected Versions` / `Fix Versions`, `Created`, `Updated`, `Deadline`,
`Estimation`, `Followers`, `Epic`.

Dates support relative expressions: `Updated: >today()-7d`,
`Deadline: <=today()`.

## Filter object style

```
find_issues { filter: { queue: 'TREK', assignee: 'user1', status: 'open' }, order: '-updatedAt' }
```

Field keys in filters use the API names: `queue`, `summary`, `assignee`,
`author`, `status`, `resolution`, `type`, `priority`, `tags`, `components`,
`sprint`, `createdAt`, `updatedAt`, `deadline`, `followers`. Special values
`empty()` / `notEmpty()` also work in filter values.

## Pagination

`perPage` (default 50) and `page` params on `find_issues`, `get_projects`,
`search_entities`, `get_issue_comments`, `get_issue_changelog`. For large
queues narrow the query instead of paging deep — results are recomputed per
page.

## Query language 2.0 (`query2`)

JSON-tree query format (v3 API): `{"assignee": {"$eq": {"$me": []}}}` equals
`Assignee: me()`. Prefer the plain `query` string unless the user asks for 2.0.

## Recipes

| Need | Query |
|---|---|
| My open issues | `Assignee: me() Resolution: empty()` |
| Unassigned in queue | `Queue: TREK Assignee: empty()` |
| Bugs from this week | `Queue: TREK Type: bug Created: >today()-7d` |
| Critical unresolved | `Priority: blocker Resolution: empty()` |
| Recently updated | `Queue: TREK "Sort by": Updated DESC` |
| Issues closing soon | `Deadline: <=today()+7d Resolution: empty()` |
| Everything about a tag | `Tags: urgent` |
| Epics in queue | `Queue: TREK Type: epic` |
