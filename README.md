# traker-mcp — MCP-сервер для Яндекс Трекера

[![CI](https://github.com/sdamarketing/tracker_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdamarketing/tracker_mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tracker-mcp?style=flat-square)](https://www.npmjs.com/package/tracker-mcp)
[![skills.sh](https://skills.sh/b/sdamarketing/tracker_mcp?style=flat-square)](https://skills.sh/sdamarketing/tracker_mcp)
[![install](https://img.shields.io/badge/curl%20%7C%20bash-установка-22c55e?style=flat-square)](https://raw.githubusercontent.com/sdamarketing/tracker_mcp/main/install.sh)

Проще говоря: **этот сервер учит вашего AI-ассистента работать с Яндекс Трекером.**
Вы говорите ассистенту «найди мои задачи», «создай задачу в очереди TREK», «закрой
TASK-123 с резолюцией “Решён”» — а он делает это через API Трекера сам, без копирования ссылок руками.

Работает с любым MCP-клиентом: **VS Code (Copilot), Cursor, Claude Desktop,
Claude Code, opencode, Windsurf, Zed, JetBrains AI Assistant**.

> 📘 Подробное руководство для новичков (получение токена, пошаговая настройка
> каждого клиента, решение проблем) — в **[docs/SETUP.md](docs/SETUP.md)**.

## Документация

Сайт документации (docs7) и LLM-индекс на Context7:
[context7.com/sdamarketing/tracker_mcp](https://context7.com/sdamarketing/tracker_mcp).

| Раздел | Содержание |
|---|---|
| [Начало работы](docs/index.ru.mdx) | Обзор, [быстрый старт](docs/quickstart.ru.mdx), [установка](docs/installation.ru.mdx), [клиенты](docs/clients.ru.mdx) |
| [Эксплуатация](docs/tools.ru.mdx) | [Инструменты](docs/tools.ru.mdx), [ресурсы и промпты](docs/resources-prompts.ru.mdx), [HTTP-сервер](docs/http-server.ru.mdx), [безопасность](docs/security.ru.mdx) |
| Гид по возможностям | [Задачи](docs/issues.ru.mdx) · [Комментарии/чеклисты/worklog/файлы](docs/issue-content.ru.mdx) · [Очереди](docs/queues.ru.mdx) · [Доски и спринты](docs/boards.ru.mdx) · [Проекты/цели/портфели](docs/projects.ru.mdx) · [Автоматизация](docs/automation.ru.mdx) · [Админ](docs/admin.ru.mdx) · [Архитектура](docs/architecture.ru.mdx) |
| Справочник | [SETUP](docs/SETUP.md) · [Карта покрытия API](docs/COVERAGE.md) · [Траблшутинг](docs/troubleshooting.ru.mdx) · [FAQ](docs/faq.ru.mdx) |

Отдельно: [CHANGELOG](CHANGELOG.md) и [skills.sh-скилл](https://skills.sh/sdamarketing/tracker_mcp).

## Ресурсы и промпты (MCP)

Помимо инструментов сервер отдаёт:

- **Resources** (`resources/list`, `resources/read`) — tracker:// URI для чтения контекста без вызова инструментов:
  - `tracker://issue/{KEY}` — карточка задачи с описанием и последними 20 комментариями (markdown);
  - `tracker://queue/{KEY}` — очередь + обязательные поля создания задач;
  - `tracker://board/{ID}` — доска с колонками и статусами;
  - `tracker://catalog/statuses|priorities|types|resolutions|linktypes` — справочники (делят TTL-кэш с инструментами);
  - `tracker://myself` — ваш профиль.
- **Prompts** (`prompts/list`, `prompts/get`) — готовые сценарии с аргументами: `standup`, `weekly-report`, `triage`, `sprint-review`, `close-issue`, `create-issue`. В клиентах с поддержкой промптов вызываются как slash-команды.

## Что умеет

187 инструментов — **полное покрытие** [API Трекера v3](https://yandex.ru/support/tracker/ru/api/about-api):

| Категория | Что можно делать |
|---|---|
| **Задачи** | искать (фильтр, язык запросов, query 2.0, scroll >10k, подсказки), создавать, читать, редактировать, переносить, менять статус, связывать, история |
| **Комментарии** | добавлять, читать (список и по одному), редактировать, удалять, реакции |
| **Чеклисты** | задачи + проекты/портфели: добавлять, отмечать, двигать, удалять |
| **Учёт времени** | записи по задаче и поиск по авторам/датам |
| **Вложения** | список, метаданные, **скачивание** (картинки/текст/база), миниатюры, загрузка, временные файлы |
| **Массово** | редактирование, перенос и закрытие задач; bulk-обновление проектов/целей |
| **Отчёты и фильтры** | сохранённые отчёты для виджетов, CRUD сохранённых фильтров |
| **Очереди** | CRUD (вкл. удаление/восстановление), права доступа, версии, компоненты, локальные поля, макросы, теги |
| **Автоматизация** | триггеры и автодействия (CRUD + логи), **воркфлоу** (статусы и переходы) |
| **Доски** | CRUD, пагинация, колонки CRUD, **спринты** (создать/запустить/архив) |
| **Дашборды** | создание дашбордов и виджетов («Время цикла») |
| **Проекты, цели, портфели** | CRUD, комментарии, чеклисты, вложения, связи, события, права, ключевые результаты и метрики (через fields) |
| **Справочники** | чтение И запись: типы, статусы, приоритеты, резолюции; глобальные поля и категории |
| **Внешние приложения** | связи задач с внешними системами (Jira и др.) |
| **Отсутствия** | отпуска/болезни/командировки (admin) |
| **Миграция** | импорт задач/комментариев/связей/трудозатрат/вложений «задним числом» (admin) |

## Безопасность для агентов

- Каждый инструмент несёт **MCP-аннотации**: чтения помечены `readOnlyHint`, все `delete_*` —
  `destructiveHint` — клиенты показывают их как подтверждаемые/Безопасные операции.
- Все `delete_*` и `bulk_*` требуют `confirm: true` (агент сначала показывает, что удалит).
- `TRACKER_READ_ONLY=1` — сервер отдаёт **только 80 инструментов чтения**, запись скрыта
  полностью. Для «просто посмотреть» интеграций.

## Скилл для AI-агентов (skills.sh)

К серверу прилагается **скилл `yandex-tracker`** — процедурные знания для агента:
язык запросов Трекера, корректные значения полей (приоритеты, статусы, резолюции),
рецепты («найди мои задачи», «закрой с резолюцией», bulk-правки) и грабли API
(`dueDate` vs `releaseDate`, обязательная резолюция при закрытии, IAM-токены ≤12ч).

```bash
npx skills add sdamarketing/tracker_mcp
```

Устанавливает скилл во все обнаруженные агенты (Claude Code, Cursor, opencode,
Codex и ещё 75+). Мастер `npm run setup` тоже предлагает установить скилл
вместе с настройкой MCP-клиента. Репозиторий скилла: [skills.sh/sdamarketing/tracker_mcp](https://skills.sh/sdamarketing/tracker_mcp).

## Установка в одну команду (macOS / Linux / WSL)

```bash
curl -fsSL https://raw.githubusercontent.com/sdamarketing/tracker_mcp/main/install.sh | bash
```

Скрипт сам: проверит систему → поставит Node.js через nvm, если его нет
(спросит согласия, sudo не нужен) → скачает сервер в `~/.traker-mcp` → соберёт
и проверит его → запустит **мастер настройки**: ключи Трекера (ввод скрыт),
проверка ключей в API, выбор AI-клиента (VS Code, Cursor, Claude Desktop,
Claude Code, opencode, Windsurf, Zed, JetBrains) и итоговый отчёт.

**Повторный запуск той же командой = обновление сервера** (конфиги клиентов не трогаются).

> 🔎 Хотите сначала прочитать скрипт? Уберите `| bash` и посмотрите вывод:
> `curl -fsSL https://raw.githubusercontent.com/sdamarketing/tracker_mcp/main/install.sh`
>
> 🪟 **Windows:** установите через WSL командой выше или вручную — см. ниже.

## Установка из npm (без клонирования)

```bash
npm install -g tracker-mcp
tracker-mcp setup     # интерактивный мастер: ключи Трекера + настройка AI-клиента
```

После этого сервер доступен командой `tracker-mcp` (в конфиг AI-клиента её и
прописывайте). Другие команды: `tracker-mcp update`, `tracker-mcp links`,
`tracker-mcp --help`.

## Official MCP Registry

Сервер опубликован в официальном реестре MCP как
`io.github.sdamarketing/tracker-mcp` (npm + Docker-пакеты, env-переменные описаны
в `server.json`). Клиенты с поддержкой реестра найдут его по имени.

## Docker (без установки чего-либо, кроме Docker)

Образ публикуется в GitHub Container Registry при каждом релизе (`v*-тег`):

```bash
# stdio (MCP-клиент запускает контейнер сам)
docker run -i --rm -e TRACKER_TOKEN -e TRACKER_ORG_ID ghcr.io/sdamarketing/tracker-mcp

# HTTP-режим
docker run --rm -p 3407:3407 -e TRACKER_TOKEN -e TRACKER_ORG_ID \
  -e MCP_AUTH_TOKEN=вашключ ghcr.io/sdamarketing/tracker-mcp serve --host 0.0.0.0
```

В конфиге агента вместо `command: node` используется
`command: docker, args: ["run","-i","--rm","-e","TRACKER_TOKEN","-e","TRACKER_ORG_ID","ghcr.io/sdamarketing/tracker-mcp"]`.

## Ручная установка (Windows или без curl)

**Шаг 1.** Убедитесь, что есть Node.js 20+ (проверка: `node -v`).

**Шаг 2.** Соберите сервер:

```bash
git clone <адрес-этого-репозитория>
cd traker_mcp
npm install
npm run build
npm run smoke   # проверка: должно быть "OK: ... 187 tools listed"
```

**Шаг 3.** Подготовьте две вещи из Трекера:

- **токен** — как получить: [docs/SETUP.md, раздел 3](docs/SETUP.md#3-токен-яндекс-трекера)
- **ID организации** — как найти: [docs/SETUP.md, раздел 4](docs/SETUP.md#4-id-организации)

**Шаг 4.** Запустите мастер установки:

```bash
npm run setup
```

Мастер спросит ключи (токен — скрытым вводом), проверит их в API Трекера,
покажет интерактивное меню клиентов (↑↓ + Enter) и настроит выбранные
(можно несколько подряд) —
через их CLI или дописав конфиг с бэкапом, — а в конце выведет отчёт.

Альтернатива: `npm run links` — откроет страницу в браузере с кнопками
установки в один клик (VS Code, Cursor, Claude Desktop) и конфигами всех
клиентов для ручного копирования.

## Подключение к вашему агенту

| Ваш агент | Быстрый способ | Конфиг-файл |
|---|---|---|
| **VS Code** (Copilot) | `npm run setup` (CLI `code`) | `.vscode/mcp.json` |
| **Cursor** | `npm run setup` | `~/.cursor/mcp.json` |
| **Claude Desktop** | `npm run setup` | `claude_desktop_config.json` |
| **Claude Code** (терминал) | `npm run setup` (CLI `claude`) | `~/.claude.json` |
| **opencode** | `npm run setup` | `~/.config/opencode/opencode.json` |
| **Windsurf** | `npm run setup` | `~/.codeium/windsurf/mcp_config.json` |
| **Zed** | `npm run setup` | `settings.json` (`context_servers`) |
| **JetBrains IDE** | `npm run setup` | `.mcp.json` в корне проекта |

Пошаговые инструкции с точными путями для macOS/Windows/Linux:
**[docs/SETUP.md](docs/SETUP.md#6-подключение-к-вашему-агенту)**.

## Проверка

После установки перезапустите агента и спросите:

> «Вызови инструмент get_current_user» — вернётся ваш профиль из Трекера.
> «Найди мои задачи в Трекере» — сработает find_issues.

## Частые проблемы

| Симптом | Причина и решение |
|---|---|
| `Missing required environment variable TRACKER_TOKEN` | токен не передан — перегенерируйте ссылки (`npm run links`) или проверьте `env` в конфиге |
| `Yandex Tracker API error 401` | неверный токен или токен истёк (IAM живёт ≤12 часов) |
| `Yandex Tracker API error 403: Organization is not available` | неверный `TRACKER_ORG_ID` или организация не подключена к Трекеру |
| Сервер не запускается в Claude Desktop (macOS) | используйте абсолютный путь к node — уже так в сгенерированном конфиге |
| У агента нет инструментов | сервер отключён — включите в списке MCP-серверов клиента и перезапустите |

Больше решений — [docs/SETUP.md, раздел 8](docs/SETUP.md#8-если-что-то-не-работает).

## Настройка сервера

| Переменная | Обязательна | Описание |
|---|---|---|
| `TRACKER_TOKEN` | да | OAuth-токен (`y0_...`, Яндекс 360) или IAM-токен (`t1....`, Yandex Cloud) |
| `TRACKER_ORG_ID` | да | Идентификатор организации |
| `TRACKER_AUTH` | нет | `oauth` (по умолчанию) или `iam` — определяет заголовки `X-Org-ID` / `X-Cloud-Org-ID` |
| `TRACKER_API_URL` | нет | По умолчанию `https://api.tracker.yandex.net/v3` |
| `TRACKER_LANG` | нет | `ru` или `en` — язык локализованных полей |
| `TRACKER_READ_ONLY` | нет | `1` — агенту видны только read-only инструменты (80 шт) |
| `TRACKER_CACHE_TTL_MS` | нет | TTL кэша справочников (по умолчанию 10 минут) |

### HTTP-режим (`serve`)

По умолчанию сервер работает по stdio (для локальных агентов). Для сетевого
доступа (команда, удалённый клиент, проксирование):

```bash
tracker-mcp serve --port 3407 --host 127.0.0.1   # значения по умолчанию
MCP_AUTH_TOKEN=s3cret tracker-mcp serve            # ключ к эндпоинту (Bearer)
curl localhost:3407/health                         # {"ok":true,"tools":187}
```

- Эндпоинт MCP: `POST/GET/DELETE /mcp` (Streamable HTTP, stateless)
- Без `MCP_AUTH_TOKEN` привязка к не-loopback-адресу отклоняется — токен
  Трекера живёт в env, голый порт в сети недопустим
- Конфиг клиента для HTTP: `"url": "http://127.0.0.1:3407/mcp"` +
  `"headers": {"Authorization": "Bearer s3cret"}`

## Безопасность

- Токен даёт агенту **те же права, что у вас в Трекере**. Выдавайте минимальные
  права (для чтения хватит `tracker:read`).
- Храните токен в `.env` (уже в `.gitignore`) или в конфиге клиента, не в коде.
- `install-links.html` содержит токен — скрипт добавляет его в `.gitignore` сам.

## Разработка

```bash
npm run typecheck   # проверка типов
npm run build       # сборка в dist/
npm run smoke       # запуск и список инструментов без обращения к API
npm run setup       # интерактивный мастер установки для AI-клиентов
npm run links       # страница с кнопками установки (deeplinks)
```

Архитектура и полный список инструментов — в [docs/SETUP.md](docs/SETUP.md) и в коде `src/tools/`.

## Лицензия и поддержка

Проблемы и идеи — в issues репозитория. API Трекера меняется — следите за
[официальной документацией](https://yandex.ru/support/tracker/ru/api/about-api).
