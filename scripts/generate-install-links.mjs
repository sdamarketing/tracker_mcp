// Генератор персональных ссылок установки для traker-mcp.
//
// Читает TRACKER_TOKEN / TRACKER_ORG_ID (из переменных окружения или .env,
// при отсутствии — спрашивает интерактивно), собирает конфиги сервера для всех
// MCP-клиентов и пишет install-links.html с кнопками установки (VS Code, Cursor,
// Claude Desktop) и готовыми блоками конфигурации для ручной настройки.
//
// Использование:  npm run links

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_JS = path.join(REPO_ROOT, 'dist', 'index.js');
const OUTPUT_HTML = path.join(REPO_ROOT, 'install-links.html');

const SERVER_NAME = 'yandex-tracker';

// --- Чтение .env -------------------------------------------------------------

function readDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  const result = {};
  if (!existsSync(envPath)) {
    return result;
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// --- Интерактивный ввод ------------------------------------------------------
// Готовая readline/promises-гонка: при piped stdin события 'line' приходят,
// пока await ещё не вызвал следующий question(), и строки теряются.
// Поэтому собираем строки в очередь и раздаём по запросу.

function makePrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const queued = [];
  const waiting = [];
  rl.on('line', (line) => {
    const resolve = waiting.shift();
    if (resolve) {
      resolve(line);
    } else {
      queued.push(line);
    }
  });
  rl.on('close', () => {
    while (waiting.length) {
      waiting.shift()('');
    }
  });
  return {
    async question(text) {
      process.stdout.write(text);
      if (queued.length > 0) {
        return queued.shift();
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    close() {
      rl.close();
    },
  };
}

// --- Форматы deeplink --------------------------------------------------------
// Проверено по: github/github-mcp-server (VS Code), auth0/auth0-mcp-server и
// тысячам других README (Cursor), реальному использованию claude:// в
// MCP-каталогах (Claude Desktop).

function vscodeLink(config) {
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://insiders.vscode.dev/redirect/mcp/install?name=${SERVER_NAME}&config=${encoded}`;
}

function cursorLink(config) {
  const encoded = Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${encoded}`;
}

function claudeDesktopLink(config) {
  const encoded = Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
  return `claude://mcp/install?name=${SERVER_NAME}&config=${encoded}`;
}

// --- Сборка -------------------------------------------------------------------

async function main() {
  const dotenv = readDotEnv();

  let token = process.env.TRACKER_TOKEN ?? dotenv.TRACKER_TOKEN;
  let orgId = process.env.TRACKER_ORG_ID ?? dotenv.TRACKER_ORG_ID;
  let auth = (process.env.TRACKER_AUTH ?? dotenv.TRACKER_AUTH ?? 'oauth').toLowerCase();
  let lang = process.env.TRACKER_LANG ?? dotenv.TRACKER_LANG ?? '';

  if (!existsSync(INDEX_JS)) {
    console.error('Ошибка: не найден dist/index.js. Сначала выполните: npm run build');
    process.exit(1);
  }

  if (!token || !orgId) {
    const prompt = makePrompt();
    try {
      if (!token) {
        token = (await prompt.question('Введите OAuth- или IAM-токен Яндекс Трекера: ')).trim();
        if (!token) {
          throw new Error('Токен обязателен.');
        }
      }
      if (!orgId) {
        orgId = (
          await prompt.question('Введите идентификатор организации (TRACKER_ORG_ID): ')
        ).trim();
        if (!orgId) {
          throw new Error('Идентификатор организации обязателен.');
        }
      }
    } finally {
      prompt.close();
    }
  }
  if (auth !== 'oauth' && auth !== 'iam') {
    auth = 'oauth';
  }

  const env = { TRACKER_TOKEN: token, TRACKER_ORG_ID: orgId };
  if (auth === 'iam') env.TRACKER_AUTH = 'iam';
  if (lang) env.TRACKER_LANG = lang;

  const nodeBin = process.execPath;

  // Общие поля stdio-сервера для клиентов в формате mcpServers (Claude Desktop,
  // Cursor, Windsurf, JetBrains .mcp.json, VS Code portable-формат).
  const stdioCommand = {
    command: nodeBin,
    args: [INDEX_JS],
    env,
  };

  // Cursor требует type: "stdio"; VS Code принимает type в списке полей stdio.
  const typedCommand = { type: 'stdio', ...stdioCommand };

  // opencode использует свой формат.
  const opencodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      [SERVER_NAME]: {
        type: 'local',
        command: [nodeBin, INDEX_JS],
        enabled: true,
        environment: env,
      },
    },
  };

  // Zed: context_servers, command — строка, args — отдельный массив.
  const zedConfig = {
    context_servers: {
      [SERVER_NAME]: {
        command: nodeBin,
        args: [INDEX_JS],
        env,
      },
    },
  };

  // VS Code .vscode/mcp.json / пользовательский mcp.json — ключ servers.
  const vscodeServersConfig = { servers: { [SERVER_NAME]: typedCommand } };

  // mcpServers-обёртка (Claude Desktop, Cursor, Windsurf, JetBrains .mcp.json).
  const mcpServersConfig = { mcpServers: { [SERVER_NAME]: stdioCommand } };

  const claudeCodeCommand =
    `claude mcp add ${SERVER_NAME} --scope user ` +
    `--transport stdio -e TRACKER_TOKEN=*** -e TRACKER_ORG_ID=*** ` +
    `-- ${JSON.stringify(nodeBin)} ${JSON.stringify(INDEX_JS)}`;

  // --- Терминальный вывод ---------------------------------------------------

  console.log('');
  console.log('Готово. Ссылки для установки (содержат ваш токен — никому не пересылайте):');
  console.log('');
  console.log('  VS Code:         ' + vscodeLink(typedCommand));
  console.log('  Cursor:           ' + cursorLink(typedCommand));
  console.log('  Claude Desktop:   ' + claudeDesktopLink(stdioCommand) + '   (новые версии)');
  console.log('');
  console.log('Открыт в браузере файл с кнопками и ручными инструкциями:');
  console.log('  ' + OUTPUT_HTML);
  console.log('');

  // --- HTML ------------------------------------------------------------------

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>traker-mcp — установка</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  .warn { border-left: 4px solid #d97706; background: #fef3c7; color: #78350f; padding: .8rem 1rem; border-radius: 6px; margin: 1rem 0; }
  @media (prefers-color-scheme: dark) { .warn { background: #451a03; color: #fde68a; } }
  .buttons { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1.5rem 0; }
  .buttons a { display: inline-block; padding: .8rem 1.4rem; border-radius: 10px; color: #fff; text-decoration: none; font-weight: 600; }
  .vscode { background: #0098FF; } .cursor { background: #000; border: 1px solid #555; } .claude { background: #D97757; }
  h2 { margin-top: 2.5rem; border-bottom: 1px solid #8884; padding-bottom: .3rem; }
  pre { background: #8881; padding: 1rem; border-radius: 8px; overflow-x: auto; position: relative; }
  code { font-size: .9em; }
  .copy { position: absolute; top: .4rem; right: .4rem; padding: .2rem .6rem; border-radius: 6px; border: 1px solid #8886; background: transparent; cursor: pointer; font-size: .8rem; }
  details { margin: .75rem 0; } summary { cursor: pointer; font-weight: 600; }
  .muted { color: #888; }
</style>
</head>
<body>
<h1>traker-mcp — установка Яндекс Трекера для вашего AI-агента</h1>

<div class="warn">
  <b>Внимание:</b> эта страница и ссылки ниже содержат ваш токен Яндекс Трекера.
  Не публикуйте её, не отправляйте ссылки никому и не коммитьте файл в git.
</div>

<h2>Установка в один клик</h2>
<p>Кликните кнопку вашего редактора — он откроется и предложит добавить сервер:</p>
<div class="buttons">
  <a class="vscode" href="${vscodeLink(typedCommand)}">Установить в VS Code</a>
  <a class="cursor" href="${cursorLink(typedCommand)}">Установить в Cursor</a>
  <a class="claude" href="${claudeDesktopLink(stdioCommand)}">Установить в Claude Desktop</a>
</div>
<p class="muted">Кнопка Claude Desktop работает в новых версиях приложения. Если после клика ничего не произошло — настройте вручную (раздел ниже).</p>
<p class="muted">Во всех редакторах после установки перезапустите агент/чат и убедитесь, что сервер yandex-tracker включён.</p>

<h2>Ручная настройка (копировать → вставить)</h2>
<p>Замените пути на свои, если переносите конфиг на другую машину. Значения токена уже подставлены.</p>

<h3>VS Code (Copilot Chat)</h3>
<p>Файл <code>.vscode/mcp.json</code> в проекте, либо пользовательский конфиг: палитра команд (Ctrl+Shift+P) → <b>MCP: Open User Configuration</b>:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(vscodeServersConfig, null, 2))}</code></pre>
<p>Или одной командой в терминале:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>code --add-mcp '${escapeHtml(JSON.stringify({ name: SERVER_NAME, ...typedCommand }))}'</code></pre>

<h3>Cursor</h3>
<p>Глобально: <code>~/.cursor/mcp.json</code>. Для одного проекта: <code>.cursor/mcp.json</code> в корне проекта:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(mcpServersConfig, null, 2))}</code></pre>

<h3>Claude Desktop</h3>
<p>В приложении: <b>Settings → Developer → Edit Config</b> (файл <code>claude_desktop_config.json</code>):</p>
<ul>
  <li>macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
  <li>Windows: <code>%APPDATA%\\Claude\\claude_desktop_config.json</code></li>
  <li>Linux: <code>~/.config/Claude/claude_desktop_config.json</code></li>
</ul>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(mcpServersConfig, null, 2))}</code></pre>
<p>После сохранения файла полностью перезапустите Claude Desktop.</p>

<h3>Claude Code (терминал)</h3>
<p>Команда (запускать вне Claude Code):</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(claudeCodeCommand.replace('***', token).replace('***', orgId))}</code></pre>
<p>Проверка: <code>claude mcp list</code> → статус <i>Connected</i>. Внутри сессии — <code>/mcp</code>.</p>

<h3>opencode</h3>
<p>Файл <code>opencode.json</code> в проекте или глобальный конфиг:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(opencodeConfig, null, 2))}</code></pre>

<h3>Windsurf</h3>
<p>Файл <code>~/.codeium/windsurf/mcp_config.json</code>:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(mcpServersConfig, null, 2))}</code></pre>

<h3>Zed</h3>
<p>Файл <code>settings.json</code> (палитра → <i>zed: open settings</i>). Обратите внимание: <code>command</code> — строка, <code>args</code> — отдельный массив:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(zedConfig, null, 2))}</code></pre>

<h3>JetBrains (IntelliJ IDEA, WebStorm и др., 2025.2+)</h3>
<p>Создайте файл <code>.mcp.json</code> в корне открытого проекта и вставьте туда:</p>
<pre><button class="copy" onclick="copy(this)">копировать</button><code>${escapeHtml(JSON.stringify(mcpServersConfig, null, 2))}</code></pre>
<p>Затем <b>Settings → Tools → AI Assistant → MCP</b> — сервер должен появиться в списке.</p>

<h2>Как проверить, что всё работает</h2>
<ol>
  <li>Перезапустите редактор/агента.</li>
  <li>Спросите у агента: <i>«Как меня зовут? Вызови инструмент get_current_user»</i> — должен вернуться ваш профиль Трекера.</li>
  <li>Потом: <i>«Найди мои задачи в Трекере»</i> — инструмент find_issues.</li>
</ol>

<script>
  function copy(btn) {
    const code = btn.parentElement.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = 'скопировано';
      setTimeout(() => (btn.textContent = 'копировать'), 1500);
    });
  }
</script>
</body>
</html>
`;

  writeFileSync(OUTPUT_HTML, html, 'utf8');

  // Открыть страницу в браузере дефолтной командой ОС.
  const openCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  import('node:child_process')
    .then(({ exec }) => exec(`${openCmd} ${JSON.stringify(OUTPUT_HTML)}`))
    .catch(() => {});

  // Не даём случайно закоммитить файл с токеном.
  const gitignorePath = path.join(REPO_ROOT, '.gitignore');
  const gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignore.split('\n').some((line) => line.trim() === 'install-links.html')) {
    appendFileSync(gitignorePath, '\ninstall-links.html\n');
  }
}

function escapeHtml(text) {
  const amp = String.fromCharCode(38); // "&"
  return text
    .replaceAll(amp, amp + 'amp;')
    .replaceAll('<', amp + 'lt;')
    .replaceAll('>', amp + 'gt;')
    .replaceAll('"', amp + 'quot;');
}

main().catch((error) => {
  console.error(`Ошибка: ${error.message}`);
  process.exit(1);
});
