import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

interface PromptMsg {
  role: 'user';
  content: { type: 'text'; text: string };
}
const msg = (text: string): { messages: PromptMsg[] } => ({
  messages: [{ role: 'user', content: { type: 'text', text } }],
});

/**
 * Готовые промпты (prompts/list + prompts/get). Тексты ведут агента через
 * конкретные инструменты сервера, чтобы сценарии воспроизводились в любом клиенте.
 */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'standup',
    {
      title: 'Стендап',
      description: 'Что сделал, что делаю, блокеры — по моим задачам в Трекере',
      argsSchema: z.object({
        user: z.string().optional().describe('Логин (по умолчанию — я)'),
      }),
    },
    ({ user }) =>
      msg(`Собери мой стендап из Яндекс Трекера${user ? ` для пользователя ${user}` : ''}:

1. Вызови find_issues с query: '${user ? `Assignee: ${user}` : 'Assignee: me()'} Resolution: empty() "Sort by": Updated DESC' — это задачи в работе.
2. Вызови find_issues с query: '${user ? `Assignee: ${user}` : 'Assignee: me()'} Updated: >week() "Sort by": Updated DESC' — недавно тронутые (там закрытые тоже — по ним «что сделал»).
3. Для задач со статусом в работе проверь дедлайны/приоритет — подсвети риски.

Сформируй три блока: **Сделал** (закрытые за неделю), **Делаю** (открытые, со статусами), **Блокеры** (зависшие, просроченные, high-приоритетные без движения). Кратко, списком, с номерами задач.`),
  );

  server.registerPrompt(
    'weekly-report',
    {
      title: 'Недельный отчёт',
      description: 'Отчёт за неделю по очереди или проекту',
      argsSchema: z.object({
        queue: z.string().optional().describe('Ключ очереди (например YTMCP)'),
        project: z.string().optional().describe('ID/shortId проекта (вместо очереди)'),
      }),
    },
    ({ queue, project }) =>
      msg(`Подготовь недельный отчёт по Яндекс Трекеру${queue ? ` для очереди ${queue}` : ''}${project ? ` для проекта ${project}` : ' (по всем моим задачам)'}:

${project ? `1. get_entity для проекта ${project} с fields: summary,entityStatus,start,end,team,description — шапка отчёта.
2. find_issues query: 'Project: ${project} Updated: >week()' — движение за неделю.` : `1. ${queue ? `get_queue для ${queue} — шапка отчёта, затем ` : ''}find_issues query: '${queue ? `Queue: ${queue} ` : ''}Updated: >week() "Sort by": Updated DESC'.`}
3. Сгруппируй: закрытые (с резолюциями), новые, в работе.
4. count_issues для чисел: закрыто за неделю (Resolved: >week()), создано (Created: >week()), всего открыто (Resolution: empty()).

Формат: сводка чисел → список закрытых → что в работе → риски. Заголовки на русском, номера задач как ссылки.`),
  );

  server.registerPrompt(
    'triage',
    {
      title: 'Разбор входящих',
      description: 'Триаж новых задач очереди: приоритет, ответственный, статус',
      argsSchema: z.object({
        queue: z.string().describe('Ключ очереди'),
        assignee: z.string().optional().describe('Кому назначить по умолчанию'),
      }),
    },
    ({ queue, assignee }) =>
      msg(`Проведи триаж очереди ${queue}:

1. find_issues query: 'Queue: ${queue} Status: open "Sort by": Created ASC' — все новые.
2. Для каждой: get_issue, оцени по описанию:
   - тип (bug/task) — если не совпадает с заявленным, предложи edit_issue;
   - приоритет — меняй ТОЛЬКО с согласия (покажи: ключ, текущий → предлагаемый, причина);
   - ответственный${assignee ? ` — предлагай ${assignee}` : ''}.
3. Если задача — дубликат другой по смыслу, предложи связь 'duplicates' через link_issues.
4. Никаких массовых изменений без явного подтверждения (bulk_* требуют confirm: true — у нас гард).

В конце — таблица: задача | тип | приоритет | исполнитель | действие к подтверждению.`),
  );

  server.registerPrompt(
    'sprint-review',
    {
      title: 'Итоги спринта',
      description: 'Ревизия спринта доски: сделано / не сделано / перенести',
      argsSchema: z.object({
        board: z.string().describe('ID доски'),
        sprint: z.string().optional().describe('ID спринта (по умолчанию — текущий/последний активный)'),
      }),
    },
    ({ board, sprint }) =>
      msg(`Подведи итоги спринта на доске ${board}:

1. ${sprint ? `get_sprint ${sprint}` : `list_board_sprints доски ${board} → возьми последний со статусом in_progress (или released)`}.
2. find_issues query: 'Sprint: <id> "Sort by": Status ASC' — все задачи спринта.
3. Разбей: сделано (Done+), не сделано.
4. Для несделанных предложи: перенос в следующий спринт (создай create_sprint при необходимости, edit_issue sprint) или возврат в бэклог — списком, на подтверждение.
5. Метрики: story points сделано/всего, count по статусам (count_issues).

Отчёт: название спринта, даты, сделано N/M, список несделанного с предлагаемыми действиями.`),
  );

  server.registerPrompt(
    'close-issue',
    {
      title: 'Закрыть задачу правильно',
      description: 'Закрытие задачи: резолюция, worklog, комментарий, чеклист',
      argsSchema: z.object({
        issue: z.string().describe('Ключ задачи (например YTMCP-1)'),
        resolution: z.string().optional().describe('Резолюция (fixed, wontFix, later…)'),
        comment: z.string().optional().describe('Финальный комментарий'),
      }),
    },
    ({ issue, resolution, comment }) =>
      msg(`Закрой задачу ${issue} по всем правилам:

1. get_issue ${issue} — сверь: чеклист выполнен (get_checklist), нет незакрытых подзадач.
2. Если вносился трудозачёт — предложи списать worklog (log_time, ISO 8601, напр. PT1H30M).
3. Спроси комментарий${comment ? ` — предложен: «${comment}»` : ''} и резолюцию${resolution ? ` — предложена: ${resolution}` : ' — покажи варианты из get_resolutions (fixed, wontFix, later, duplicate…)'}.
4. get_issue_transitions ${issue} → выбери переход в конечный статус (done/closed) → execute_transition с resolution${comment ? ` и comment: «${comment}»` : ''}.

ВАЖНО: закрытие без резолюции отвергается API — резолюция обязательна.`),
  );

  server.registerPrompt(
    'create-issue',
    {
      title: 'Создать задачу правильно',
      description: 'Создание задачи: очередь, тип, обязательные поля, уникальность',
      argsSchema: z.object({
        queue: z.string().describe('Ключ очереди'),
      }),
    },
    ({ queue }) =>
      msg(`Помоги создать задачу в очереди ${queue}:

1. get_queue_fields ${queue} — какие поля обязательны и какие типы доступны (issueTypesConfig).
2. Спроси: тему (summary), тип, описание (поддерживается YFM-разметка), приоритет, дедлайн, теги.
3. find_issues query: 'Queue: ${queue} Summary: ~"<тема>"' — проверь, нет ли дубликата, прежде чем создавать.
4. create_issue с собранными полями; локальные поля очереди — через extraFields по СОСТАВНОМУ id вида '61a1b2c3…--fieldKey' (короткий ключ API не примет).
5. Верни ключ и ссылку https://tracker.yandex.ru/<KEY>.`),
  );
}
