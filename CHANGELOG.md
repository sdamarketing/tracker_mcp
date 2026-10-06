# Changelog

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
