# Field catalogs and valid values

Yandex Tracker organizations can define **custom** statuses, priorities,
resolutions, issue types and fields. The standard sets below cover most orgs,
but the tools `get_statuses`, `get_priorities`, `get_resolutions`,
`get_issue_types`, `get_issue_fields` always return the live, org-specific
catalog. Call them when:

- a create/edit call fails with 400 on a field value,
- the user mentions a status/priority you haven't seen,
- working with an unfamiliar queue (`get_queue_fields` shows its required and
  allowed fields, including local custom fields with ids like
  `<queue-id>--fieldname`).

## Standard issue statuses (keys)

`open` (Открыт), `needInfo`, `inProgress`, `testing`, `tested`, `inReview`,
`resolved` (Решён), `closed` (Закрыт), `cancelled`. Typical development
workflows expose transitions like `start_progress`, `resolve`, `need_info`,
`in_review`, `close`, `wont_fix` — always discover them per issue with
`get_issue_transitions`.

## Standard priorities (keys)

`trivial`, `minor`, `normal`, `critical`, `blocker`. Some orgs add
`minimal`, `important` — and **there is no universal `major`**; verify with
`get_priorities`.

## Standard resolutions (keys)

`fixed`, `wontFix`, `duplicate`, `later`, `cantReproduce`, `invalid`.

## Standard issue types (keys)

`task`, `bug`, `epic`, `story`/`feature`, `suggestion`, `release`, `milestone`,
`incident` (org-dependent).

## Common issue fields for create/edit

| Field | Format / values |
|---|---|
| `summary` | string, required on create |
| `queue` | case-sensitive key, e.g. `TREK` |
| `description` | YFM markdown |
| `type`, `priority`, `status` | key, id or name |
| `assignee`, `author`, `followers` | login or user id (array for followers) |
| `parent` | parent issue key |
| `tags`, `components`, `sprint`, `affectedVersions`, `fixVersions` | arrays (names or ids) |
| `deadline`, `startDate`, `dueDate` | `YYYY-MM-DD` |
| `estimation` | ISO 8601 duration (`P3DT2H`, `P2W`) |
| `unique` | dedup guard: second create with same value returns 409 |

Array fields in edits accept commands instead of full arrays:
`{"tags": {"add": ["x"]}}`, `{"tags": {"remove": ["x"]}}`,
`{"tags": {"set": ["x"]}}`, `{"tags": {"replace": [{"target": "x", "replacement": "y"}]}}`.
A `null` value clears a field.

## Entity statuses (projects/portfolios/goals)

- Projects/portfolios: `draft`, `draft2`, `in_progress`, `according_to_plan`,
  `postponed`, `at_risk`, `blocked`, `launched`, `cancelled`.
- Goals: `draft`, `according_to_plan`, `at_risk`, `blocked`, `achieved`,
  `partially_achieved`, `not_achieved`, `exceeded`, `cancelled`.

## Workflow templates for `create_queue`

`developmentPresetWorkflow`, `scrumDevelopmentPresetWorkflow`,
`kanbanDevelopmentPresetWorkflow`, `basicSupportPresetWorkflow`,
`tieredSupportPresetWorkflow`, `marketingPresetWorkflow`,
`hrPresetWorkflow`, `recruitmentPresetWorkflow`,
`approvementPresetWorkflow`, `documentsPresetWorkflow`,
`quickStartV2PresetWorkflow`, `serviceProvisionPresetWorkflow`,
`manufacturingPresetWorkflow`, `outsourceDevelopmentPresetWorkflow`,
`goalsManagmentPresetWorkflow`.

## Dashboard widget layouts

`one-column`, `two-columns`, `three-columns`, `narrow-left-wide-right`,
`one-top-two-bottom`.

## Comment reaction names

`LIKE`, `DISLIKE`, `LAUGH`, `HOORAY`, `CONFUSED`, `HEART`, `ROCKET`, `EYES`,
`FIRE`, `OK`, `FACEPALM`, `CHECK`.

## Access right structures

Queue access (`set_queue_access`): actions `create | write | read | grant |
deny` → each targets `users` (logins/ids), `groups` (ids), `roles` (`author`,
`assignee`, `follower`, `access`). Arrays overwrite, `{"add": […]}` /
`{"remove": […]}` apply deltas. `deny` supports only users and groups.

Entity permissions (`update_entity_permissions`): grant/revoke per `READ` |
`GRANT` | `WRITE` → `users`, `groups`, `roles` (`AUTHOR`, `OWNER`, `CLIENT`,
`FOLLOWER`, `MEMBER`).

## Absence types (gaps)

`vacation`, `paid_day_off`, `illness`, `absence`, `trip`, `conference_trip`,
`conference`, `learning`, `maternity`, `duty`.

## Issue field type class names (create_issue_field / create_queue_local_field)

`ru.yandex.startrek.core.fields.` + `StringFieldType` | `TextFieldType` |
`DateFieldType` | `DateTimeFieldType` | `FloatFieldType` | `IntegerFieldType` |
`UserFieldType` | `UriFieldType` | `MoneyFieldType` | `MoneyWithRateFieldType` |
`TimeTrackingDurationFieldType`.

## Issue field categories

Category ids come from `get_issue_fields` (each field shows its `category`) —
pass the category id string to `create_issue_field` /
`create_issue_field_category` creates new ones.
