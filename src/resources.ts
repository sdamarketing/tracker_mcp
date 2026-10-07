import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/server';
import type { TrackerClient } from './client.js';
import { cached } from './cache.js';

const MD = 'text/markdown';

type AnyRec = Record<string, unknown>;

const str = (v: unknown): string =>
  v == null ? '' : typeof v === 'object' ? str((v as AnyRec).key ?? (v as AnyRec).display ?? (v as AnyRec).name ?? (v as AnyRec).id ?? v) : String(v);
const nameOf = (v: unknown): string =>
  v == null ? '' : typeof v === 'object' ? (str(nameOf((v as AnyRec).name)) || str((v as AnyRec).display) || str((v as AnyRec).key)) : String(v);

const people = (v: unknown): string =>
  Array.isArray(v) ? v.map(nameOf).filter(Boolean).join(', ') : nameOf(v);

const text = (uri: string, body: string) => ({
  contents: [{ uri, mimeType: MD, text: body }],
});

function renderIssue(issue: AnyRec, comments?: AnyRec[]): string {
  const lines: string[] = [
    `# ${str(issue.key)}: ${str(issue.summary)}`,
    '',
    `- Статус: **${nameOf(issue.status)}**${issue.resolution ? ` (${nameOf(issue.resolution)})` : ''}`,
    `- Тип: ${nameOf(issue.type)} · Приоритет: ${nameOf(issue.priority)}`,
    `- Очередь: ${str((issue.queue as AnyRec)?.key ?? issue.queue)}`,
    `- Автор: ${nameOf(issue.createdBy)} · Исполнитель: ${nameOf(issue.assignee) || '—'} · Наблюдатели: ${people(issue.followers) || '—'}`,
    `- Создана: ${str(issue.createdAt)} · Обновлена: ${str(issue.updatedAt)}${issue.deadline ? ` · Дедлайн: ${str(issue.deadline)}` : ''}`,
    '',
    '## Описание',
    '',
    str(issue.description) || '_пусто_',
  ];
  if (comments?.length) {
    lines.push('', `## Комментарии (${comments.length})`, '');
    for (const c of comments.slice(-20)) {
      lines.push(`**${nameOf(c.createdBy)}** (${str(c.createdAt)}):`, '', str(c.text), '', '---', '');
    }
  }
  return lines.join('\n');
}

function renderQueue(q: AnyRec, fields?: AnyRec[]): string {
  const lines: string[] = [
    `# Очередь ${str(q.key)}: ${nameOf(q.name)}`,
    '',
    `- Владелец: ${nameOf(q.lead)}`,
    `- Тип по умолчанию: ${nameOf(q.defaultType)} · Приоритет: ${nameOf(q.defaultPriority)}`,
    `- Описание: ${str(q.description) || '—'}`,
  ];
  if (fields?.length) {
    lines.push('', '## Обязательные поля создания задачи', '');
    for (const f of fields) lines.push(`- \`${str(f.id ?? f.key)}\` (${nameOf(f.name)})`);
  }
  return lines.join('\n');
}

function renderBoard(b: AnyRec, columns?: AnyRec[]): string {
  const lines: string[] = [
    `# Доска: ${nameOf(b.name)} (id ${str(b.id)})`,
    '',
    `- Владелец: ${nameOf(b.owner)}`,
  ];
  if (columns?.length) {
    lines.push('', '## Колонки', '');
    for (const c of columns)
      lines.push(`- **${str(c.name)}** ← статусы: ${(c.statuses as unknown[] ?? []).map((s) => str(s)).join(', ')}${c.limit ? ` · WIP-лимит: ${c.limit}` : ''}`);
  }
  return lines.join('\n');
}

function renderCatalog(title: string, items: AnyRec[]): string {
  return [
    `# ${title}`,
    '',
    ...items.map((i) => `- \`${str(i.key ?? i.id)}\` — ${nameOf(i.name)}${i.description ? `: ${str(i.description)}` : ''}`),
  ].join('\n');
}

export function registerResources(server: McpServer, client: TrackerClient): void {
  const catalog = (key: string, path: string, title: string) =>
    server.registerResource(
      `catalog-${key}`,
      `tracker://catalog/${key}`,
      { title, description: `Справочник организации: ${title}`, mimeType: MD },
      // Делим TTL-кэш справочников с инструментами (ключи catalog:* как в users.ts)
      async (uri) => text(uri.href, renderCatalog(title, await cached(`catalog:${key}`, () => client.get<AnyRec[]>(path)))),
    );

  catalog('statuses', '/statuses', 'Статусы задач');
  catalog('priorities', '/priorities', 'Приоритеты задач');
  catalog('types', '/issuetypes', 'Типы задач');
  catalog('resolutions', '/resolutions', 'Резолюции задач');
  catalog('linktypes', '/linktypes', 'Типы связей задач');

  server.registerResource(
    'myself',
    'tracker://myself',
    { title: 'Текущий пользователь', description: 'Профиль текущего пользователя Трекера', mimeType: MD },
    async (uri) => {
      const u = await client.get<AnyRec>('/myself');
      return text(uri.href, `# ${nameOf(u.display) || str(u.login)}\n\n- Логин: \`${str(u.login)}\` · uid: ${str(u.uid)}${u.email ? `\n- Email: ${str(u.email)}` : ''}`);
    },
  );

  server.registerResource(
    'issue',
    new ResourceTemplate('tracker://issue/{key}', {
      list: async () => { try {
        const issues = await client.post<AnyRec[]>('/issues/_search', {

          query: 'Assignee: me() Resolution: empty() "Sort by": Updated DESC',
        }, { perPage: 50 });
        return {
          resources: (issues ?? []).map((i) => ({
            uri: `tracker://issue/${str(i.key)}`,
            name: `${str(i.key)}: ${str(i.summary)}`,
            mimeType: MD,
          })),
        }; } catch { return { resources: [] }; }
      },
    }),
    { title: 'Задача Трекера', description: 'Карточка задачи с описанием и комментариями', mimeType: MD },
    async (uri, { key }) => {
      const k = str(key);
      const [issue, comments] = await Promise.all([
        client.get<AnyRec>(`/issues/${k}`),
        client.get<AnyRec[]>(`/issues/${k}/comments`).catch(() => []),
      ]);
      return text(uri.href, renderIssue(issue, comments));
    },
  );

  server.registerResource(
    'queue',
    new ResourceTemplate('tracker://queue/{key}', {
      list: async () => { try {
        const queues = await client.get<AnyRec[]>('/queues', { perPage: 100 });
        return {
          resources: (queues ?? []).map((q) => ({
            uri: `tracker://queue/${str(q.key)}`,
            name: `${str(q.key)}: ${nameOf(q.name)}`,
            mimeType: MD,
          })),
        }; } catch { return { resources: [] }; }
      },
    }),
    { title: 'Очередь Трекера', description: 'Параметры очереди и обязательные поля', mimeType: MD },
    async (uri, { key }) => {
      const k = str(key);
      const [q, fields] = await Promise.all([
        client.get<AnyRec>(`/queues/${k}`),
        client.get<AnyRec[]>(`/queues/${k}/fields`).catch(() => []),
      ]);
      return text(uri.href, renderQueue(q, fields));
    },
  );

  server.registerResource(
    'board',
    new ResourceTemplate('tracker://board/{id}', {
      list: async () => { try {
        const boards = await client.get<AnyRec[]>('/boards', { perPage: 100 });
        return {
          resources: (boards ?? []).map((b) => ({
            uri: `tracker://board/${str(b.id)}`,
            name: nameOf(b.name),
            mimeType: MD,
          })),
        }; } catch { return { resources: [] }; }
      },
    }),
    { title: 'Доска Трекера', description: 'Доска с колонками и статус-маппингом', mimeType: MD },
    async (uri, { id }) => {
      const bid = str(id);
      const [b, columns] = await Promise.all([
        client.get<AnyRec>(`/boards/${bid}`),
        client.get<AnyRec[]>(`/boards/${bid}/columns`).catch(() => []),
      ]);
      return text(uri.href, renderBoard(b, columns));
    },
  );
}
