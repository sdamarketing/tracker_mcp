# Changelog

## [1.0.6] — 2026-10-07

### Added (YTMCP-1)
- **`tracker-mcp serve --port 3407`** — HTTP-транспорт (Streamable HTTP, stateless,
  эндпоинт `/mcp` + `/health`). Креды Трекера из env процесса; доступ к эндпоинту
  закрывается `MCP_AUTH_TOKEN` (Bearer). Без токена — только loopback-хост.
- Шаблон сервера вынесен в `src/server.ts` (общий для stdio и HTTP входов),
  исправлен баланс скобок в `src/index.ts` (был лишний `}`).

## [1.0.5] — 2026-10-05

### Added (benchmarked against bim-ba/ycli coverage matrix)
- `get_link_types` — каталог типов связей (недокументированный GET /v3/linktypes, проверен вживую)
- `download_entity_attachment` — скачивание вложений проектов/портфелей/целей
- **MCP tool annotations**: readOnlyHint для всех чтений, destructiveHint для delete_*
- **TRACKER_READ_ONLY=1** — сервер регистрирует только 80 read-only инструментов

### Проверено и отвергнуто
- `POST /entities/{type}/bulkchange/_get` — не существует (404), в API нет bulk-чтения сущностей


## [1.0.4] — 2026-10-05

### Fixed (found during a live full-API walkthrough)
- `edit_worklog_record` / `delete_worklog_record`: path was `/worklog/{id}` → correct `/issues/{issueId}/worklog/{id}` (both take `issueId` now)
- Board/sprint writes: `If-Match` is now sent as a quoted ETag (`"3"`) — plain values got 400
- `update_entity`: passes through `comment` and `links`

### Skill
- Полный проход по UI-вкладкам Трекера: задачи, очереди (локальные поля, компоненты, триггеры, автодействия, макросы), воркфлоу, доски/спринты, отчёты, отпуска, импорт
- Новая «рецептурная» про проекты + 12 грабель, проверенных на реальной организации (429-рейтинг, compound-id локальных полей, immutable issueTypesConfig, правила воркфлоу и пр.)


## [1.0.0] — 2026-10-04

### Highlights
- **Полное покрытие Tracker API v3**: 185 инструментов, сверено с официальной документацией (199 страниц API-справочника)
- **Интерактивный установщик**: `curl … | bash` с баннером, спиннерами и мастером `npm run setup` (стрелочный селектор клиента, проверка ключей вживую, настройка 8 AI-клиентов)
- **Скилл `yandex-tracker`** для [skills.sh](https://skills.sh/sdamarketing/tracker_mcp): карта инструментов, рецепты, справочники значений

### Added
- In-memory TTL-кэш справочников (статусы, приоритеты, типы, резолюции, поля), `TRACKER_CACHE_TTL_MS` для настройки; инвалидация при admin-записях
- Защита `confirm: true` для 29 деструктивных и массовых операций (все delete_* и bulk_*)
- Integration-тесты (`tests/e2e.mjs`): реальный сервер против локального стаба API, без токена
- Проверка дрейфа документации: `npm run docs:check` сверяет API-индекс с `tests/api-docs-snapshot.txt`
- CI: GitHub Actions (build, typecheck, smoke, e2e, docs drift) на Node 20/22/24
- `npm run update` — самообновление установленной копии
- Публикация в npm как `tracker-mcp`

## [1.0.2]

- CLI-обёртка `bin/tracker-mcp.mjs`: подкоманды `setup`, `update`, `links`, `--help`, `--version`
- Понятная ошибка при отсутствии env: указывает на `tracker-mcp setup`


## [0.1.0] — первичная версия

- 67 → 185 инструментов по мере покрытия API, установщик, документация, скилл
