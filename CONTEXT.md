# CONTEXT.md — глоссарий домена

Язык проекта. Только термины и их значения — без решений об устройстве
(решения живут в `docs/adr/`).

## Сервисы и продукты

- **Yandex Tracker** — трекер задач Яндекса; единственный сервис в нашем скоупе.
  API: `api.tracker.yandex.net/v3` (+ один документированный эндпоинт на `/v2`).
- **MCP (Model Context Protocol)** — протокол, по которому AI-клиенты вызывают инструменты.
- **tracker-mcp** — наш пакет/сервер (npm: `tracker-mcp`, GitHub: `sdamarketing/tracker_mcp`).
- **MCP-клиент / harness** — агент-хост: opencode, Claude Code, Cursor, Claude Desktop,
  VS Code, Windsurf, Zed, JetBrains.

## Сущности Трекера (термины API)

- **Issue / Задача** — задача в очереди; ключ вида `QUEUE-123`.
- **Queue / Очередь** — контейнер задач с собственными типами, воркфлоу и полями.
- **Entity / Сущность** — проект (`project`), портфель (`portfolio`) или цель (`goal`).
  Не путать с «задачей». У сущностей нет поля `priority` и нет вех (milestones) в API.
- **Workflow / Воркфлоу** — набор статусов и переходов между ними; переходы задаются
  actions на статусе-источнике.
- **Компонент / версия** — разрезы очереди. Версии: `dueDate` (не `releaseDate`).
- **Локальное поле** — кастомное поле очереди; в запросах задачи адресуется
  составным id `{queueNumericId}--{fieldKey}`.
- **Связь (link)** — между задачами или сущностями; типы: relates, depends/subtask/
  duplicates/epic/clone (задачи) и depends on/is dependent by/works towards/
  parent-child/is supported by (сущности). Каталог: `get_link_types`.
- **Worklog** — запись о затраченном времени; правится по адресу `/issues/{id}/worklog/{id}`.
- **Спринт / доска** — спринты требуют включённого бэклога в UI очереди (в API нет).

## Эксплуатация

- **OAuth token (`y0__…`)** — Яндекс 360; заголовок `Authorization: OAuth …` + `X-Org-ID`.
- **IAM token (`t1.…`)** — Yandex Cloud/Identity Hub; `Authorization: Bearer …` +
  `X-Cloud-Org-ID`; живёт ≤12 часов.
- **confirm: true** — обязательный параметр всех delete_/bulk_ инструментов.
- **Read-only mode** — `TRACKER_READ_ONLY=1`: сервер отдаёт только инструменты чтения.
- **Скилл** — `skills/yandex-tracker/` (skills.sh), процедурные знания для агента.
- **docs7** — движок документации (Context7), строит сайт из `docs/docs.json` + MDX.
