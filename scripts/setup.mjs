#!/usr/bin/env node
// traker-mcp · Мастер установки
//
// Интерактивный установщик: проверяет окружение, спрашивает ключи Яндекс
// Трекера, проверяет их прямо в API, даёт выбрать AI-клиента и настраивает
// его автоматически (через CLI клиента или дописывая конфиг с бэкапом).
//
// Использование:  npm run setup

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface, emitKeypressEvents } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_JS = path.join(REPO_ROOT, 'dist', 'index.js');
const DOTENV = path.join(REPO_ROOT, '.env');
const SERVER_NAME = 'yandex-tracker';

// --- Консоль ---------------------------------------------------------------

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function step(n, total, title) {
  console.log(`\n${bold(cyan(`[${n}/${total}] ${title}`))}`);
}

function ok(text) {
  console.log(`  ${green('✔')} ${text}`);
}

function warn(text) {
  console.log(`  ${yellow('⚠')} ${text}`);
}

function fail(text) {
  console.log(`  ${red('✖')} ${text}`);
}

// --- Ввод -------------------------------------------------------------------
// Два режима:
//  • TTY — полный захват stdin в raw mode (как inquirer): все вопросы, скрытый
//    ввод и селектор работают через собственные обработчики, readline не
//    используется вовсе — иначе его слушатели конкурируют за байты stdin.
//  • Не-TTY (pipe, CI) — очередь строк поверх readline: piped-ввод приходит
//    одним куском, readline/promises теряет строки между вопросами (известная
//    гонка), поэтому строки собираются в очередь и раздаются по запросу.

const IS_TTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

/** Строка ввода в raw mode: свой эхо-вывод, backspace, Ctrl+C. hidden → '*'. */
function rawLine({ prompt, hidden = false }) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const out = process.stdout;
    out.write(prompt);
    let value = '';
    let settled = false;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    // Вставленный из буфера текст приходит ОДНИМ chunk'ом — обрабатываем
    // посимвольно, а не chunk целиком.
    const onData = (chunk) => {
      if (settled) {
        stdin.removeListener('data', onData);
        return;
      }
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          settled = true;
          stdin.removeListener('data', onData);
          stdin.setRawMode(false);
          out.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          out.write('\n');
          process.exit(1);
        } else if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            out.write('\b \b');
          }
        } else if (ch >= ' ' && ch !== '\u001b') {
          value += ch;
          out.write(hidden ? '*' : ch);
        }
        // прочие управляющие символы (стрелки и т.п.) игнорируем
      }
    };
    stdin.on('data', onData);
  });
}

function createPromptSession() {
  const session = {
    rl: null,
    queued: [],
    waiting: [],
    closed: false,
    spawn() {
      if (IS_TTY) return; // в TTY readline не создаём — весь ввод через rawLine
      session.rl = createInterface({ input: process.stdin, output: process.stdout });
      session.rl.on('line', (line) => {
        const resolve = session.waiting.shift();
        if (resolve) resolve(line);
        else session.queued.push(line);
      });
      session.rl.on('close', () => {
        session.closed = true;
        while (session.waiting.length) session.waiting.shift()('');
      });
    },
    question(text) {
      if (IS_TTY) {
        return rawLine({ prompt: text });
      }
      process.stdout.write(text);
      if (session.queued.length > 0) {
        return Promise.resolve(session.queued.shift());
      }
      // Ввод закончился (EOF/закрытый терминал) — дальше ждать нечего.
      if (session.closed) {
        return Promise.resolve('');
      }
      return new Promise((resolve) => session.waiting.push(resolve));
    },
    askHidden(text) {
      if (IS_TTY) {
        return rawLine({ prompt: text, hidden: true });
      }
      return session.question(text);
    },
    close() {
      if (IS_TTY) return;
      session.rl?.close();
      session.rl = null;
      // Ввод, успевший попасть в очередь ДО закрытия (например, вставка во
      // время другого вопроса), не должен отвечать на следующий вопрос.
      session.queued.length = 0;
    },
  };
  session.spawn();
  return session;
}

async function askNumber(promptSession, text, min, max) {
  for (;;) {
    const raw = await promptSession.question(text);
    if (raw === '' && promptSession.closed) {
      throw new Error('Ввод прерван (терминал закрыт). Запустите `npm run setup` заново.');
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= min && n <= max) {
      return n;
    }
    warn(`Введите число от ${min} до ${max}.`);
  }
}

async function askYesNo(promptSession, text, defaultYes = true) {
  const hint = defaultYes ? '[Y/n] ' : '[y/N] ';
  const yes = ['y', 'yes', 'да', 'д', '1'];
  const no = ['n', 'no', 'нет', 'н', '0'];
  for (;;) {
    const raw = (await promptSession.question(`${text} ${hint}`)).trim().toLowerCase();
    if (raw === '') return defaultYes;
    if (yes.includes(raw)) return true;
    if (no.includes(raw)) return false;
  }
}

// --- Интерактивный выбор из списка (↑↓ / ENTER / SPACE / ESC / цифры) ---------

const SELECT_HINT = '↑↓ выбирать   ENTER/SPACE подтвердить   ESC отмена';

/**
 * Радио-список в стиле opencode:
 *   → (●) активный пункт
 *     (○) остальные
 * Требует TTY на входе и выходе; иначе возвращает null (вызывающий код
 * переключается на нумерованный fallback). ESC → -1.
 */
function selectInteractiveRaw(promptSession, { items }) {
  if (!IS_TTY) {
    return Promise.resolve(null);
  }
  promptSession.close();

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const out = process.stdout;
    const width = Math.max(50, out.columns ?? 80);
    const frameLines = items.length + 1; // подсказка + пустая + пункты
    let cursor = 0;
    let finished = false;

    const truncate = (text, max) =>
      text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;

    const lineFor = (i) => {
      const active = i === cursor;
      const prefix = active ? ' → (●) ' : '   (○) ';
      const label = truncate(items[i].label, width - prefix.length - 2);
      const room = width - prefix.length - label.length - 2;
      const description =
        items[i].description && room > 4
          ? '  ' + dim(truncate('— ' + items[i].description, room))
          : '';
      const text = active ? bold(cyan(label)) : label;
      return prefix + text + description;
    };

    const frame = (moveUp) => {
      let s = moveUp > 0 ? `\x1b[${moveUp}A` : '';
      s += '\x1b[?25l'; // спрятать курсор
      s += `  ${dim(SELECT_HINT)}\n\n`;
      for (let i = 0; i < items.length; i++) {
        s += lineFor(i) + '\n';
      }
      return s;
    };

    const cleanup = () => {
      finished = true;
      stdin.setRawMode(false);
      stdin.removeListener('keypress', onKey);
      out.write('\x1b[?25h'); // вернуть курсор
    };

    const onKey = (str, key) => {
      if (finished) return;
      if (key.ctrl && (key.name === 'c' || key.name === 'q')) {
        process.stdout.write('\n');
        process.exit(1);
      }
      switch (key.name) {
        case 'up':
        case 'k':
          cursor = (cursor - 1 + items.length) % items.length;
          out.write(frame(frameLines));
          break;
        case 'down':
        case 'j':
          cursor = (cursor + 1) % items.length;
          out.write(frame(frameLines));
          break;
        case 'return':
        case 'space':
          cleanup();
          out.write(frame(frameLines));
          out.write('\n');
          promptSession.spawn();
          resolve(cursor);
          break;
        case 'escape':
          cleanup();
          // стереть блок списка
          out.write(`\x1b[${frameLines}A`);
          for (let i = 0; i < frameLines; i++) out.write('\x1b[2K\n');
          promptSession.spawn();
          resolve(-1);
          break;
        default:
          if (str && /^[1-9]$/.test(str)) {
            const n = Number(str);
            if (n <= items.length) {
              cursor = n - 1;
              out.write(frame(frameLines));
            }
          }
      }
    };

    stdin.setRawMode(true);
    emitKeypressEvents(stdin);
    stdin.on('keypress', onKey);
    stdin.resume();
    out.write(frame(0));
  });
}

/**
 * Выбор из списка с fallback: в TTY — интерактивный виджет, иначе —
 * нумерованный список. Возвращает индекс или -1 (ESC/отмена).
 */
async function chooseFromList(promptSession, { title, items }) {
  const interactive = await selectInteractiveRaw(promptSession, { items });
  if (interactive !== null) {
    return interactive;
  }
  console.log(`  ${bold(title)}`);
  items.forEach((item, i) => {
    console.log(`  ${i + 1}) ${item.label} ${item.description ? dim('— ' + item.description) : ''}`);
  });
  return (await askNumber(promptSession, `  Выбор [1-${items.length}]: `, 1, items.length)) - 1;
}

// --- Утилиты -----------------------------------------------------------------

function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function readDotEnv() {
  if (!existsSync(DOTENV)) return {};
  const result = {};
  for (const line of readFileSync(DOTENV, 'utf8').split('\n')) {
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

/**
 * Дописать сервер в JSON-конфиг клиента. Существующий файл копируется в
 * *.bak-<дата>. mutator получает распарсенный объект и меняет его на месте.
 */
function upsertJsonConfig(filePath, mutator) {
  let config = {};
  let backupPath = null;
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf8');
    backupPath = `${filePath}.bak-${timestamp()}`;
    copyFileSync(filePath, backupPath);
    if (raw.trim()) {
      try {
        config = JSON.parse(raw);
      } catch {
        warn(`Файл ${filePath} повреждён (не JSON). Бэкап: ${backupPath}. Создаю заново.`);
        config = {};
      }
    }
  }
  mutator(config);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return { filePath, backupPath };
}

/** Найти CLI-команду (code / claude) с учётом Windows. */
function resolveCommand(name) {
  const candidates = process.platform === 'win32' ? [`${name}.cmd`, name] : [name];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { shell: false, encoding: 'utf8' });
    if (probe.error === undefined && probe.status === 0) return candidate;
  }
  return null;
}

// --- Пути конфигов -------------------------------------------------------------

const HOME = os.homedir();

function claudeDesktopConfigPath() {
  if (process.platform === 'darwin') {
    return path.join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (process.platform === 'win32') {
    return path.join(HOME, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  }
  return path.join(HOME, '.config', 'Claude', 'claude_desktop_config.json');
}

function zedSettingsPath() {
  if (process.platform === 'darwin') {
    return path.join(HOME, 'Library', 'Application Support', 'Zed', 'settings.json');
  }
  if (process.platform === 'win32') {
    return path.join(HOME, 'AppData', 'Roaming', 'Zed', 'settings.json');
  }
  return path.join(HOME, '.config', 'zed', 'settings.json');
}

// --- Клиенты ---------------------------------------------------------------------

const CLIENTS = {
  vscode: {
    title: 'VS Code (Copilot Chat)',
    hint: 'Добавит сервер в профиль VS Code через CLI `code`.',
    menu: 'профиль VS Code через CLI `code`',
  },
  cursor: {
    title: 'Cursor',
    hint: 'Допишет сервер в ~/.cursor/mcp.json (доступен во всех проектах).',
    menu: '~/.cursor/mcp.json',
  },
  claudeDesktop: {
    title: 'Claude Desktop',
    hint: 'Допишет сервер в claude_desktop_config.json.',
    menu: 'claude_desktop_config.json',
  },
  claudeCode: {
    title: 'Claude Code (терминал)',
    hint: 'Выполнит `claude mcp add --scope user`.',
    menu: 'claude mcp add --scope user',
  },
  opencode: {
    title: 'opencode',
    hint: 'Допишет сервер в ~/.config/opencode/opencode.json.',
    menu: '~/.config/opencode/opencode.json',
  },
  windsurf: {
    title: 'Windsurf',
    hint: 'Допишет сервер в ~/.codeium/windsurf/mcp_config.json.',
    menu: '~/.codeium/windsurf/mcp_config.json',
  },
  zed: {
    title: 'Zed',
    hint: 'Допишет сервер в settings.json (ключ context_servers).',
    menu: 'settings.json → context_servers',
  },
  jetbrains: {
    title: 'JetBrains IDE (IntelliJ, WebStorm...)',
    hint: 'Создаст .mcp.json в выбранной папке проекта.',
    menu: '.mcp.json в корне проекта',
  },
};

// --- Мастер -----------------------------------------------------------------------

async function main() {
  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  console.log('');
  console.log(bold(`traker-mcp v${pkg.version} · Мастер установки Яндекс Трекера для AI-агентов`));
  console.log(cyan('═══════════════════════════════════════════════════════════════'));

  const prompt = createPromptSession();
  let token = null;
  let orgId = null;
  let auth = 'oauth';

  // [1/5] Окружение -----------------------------------------------------------

  step(1, 5, 'Проверка окружения');
  ok(`Node.js ${process.version}`);

  if (!existsSync(INDEX_JS)) {
    console.log('  … Сервер не собран. Запускаю npm run build…');
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (build.status !== 0 || !existsSync(INDEX_JS)) {
      fail('Сборка не удалась. Выполните `npm install && npm run build` и повторите.');
      process.exit(1);
    }
  }
  ok(`Сервер собран: ${path.relative(REPO_ROOT, INDEX_JS)}`);

  // [2/5] Ключи ------------------------------------------------------------------

  step(2, 5, 'Ключи доступа к Яндекс Трекеру');
  const dotenv = readDotEnv();
  const envToken = process.env.TRACKER_TOKEN ?? dotenv.TRACKER_TOKEN;
  const envOrgId = process.env.TRACKER_ORG_ID ?? dotenv.TRACKER_ORG_ID;

  if (envToken && envOrgId) {
    ok('Ключи найдены (.env или переменные окружения).');
    token = envToken;
    orgId = envOrgId;
    auth = (process.env.TRACKER_AUTH ?? dotenv.TRACKER_AUTH ?? 'oauth').toLowerCase();
  } else {
    if (envToken || envOrgId) {
      warn('Найден только один из двух ключей — недостающие введу вручную.');
    }
    console.log('  Где взять ключи: docs/SETUP.md, разделы 3 и 4.');
    token = await prompt.askHidden('  Токен Яндекс Трекера (ввод скрыт): ');
    if (!token) {
      fail('Токен обязателен. Прервано.');
      process.exit(1);
    }
    orgId = (await prompt.question('  ID организации (TRACKER_ORG_ID): ')).trim();
    if (!orgId) {
      fail('ID организации обязателен. Прервано.');
      process.exit(1);
    }
    const authIdx = await chooseFromList(prompt, {
      title: 'Тип организации:',
      items: [
        {
          label: 'Яндекс 360 для бизнеса',
          description: 'OAuth-токен y0__… · заголовок X-Org-ID',
        },
        {
          label: 'Yandex Cloud / Identity Hub',
          description: 'IAM-токен t1.… · заголовок X-Cloud-Org-ID · живёт ≤12 часов',
        },
      ],
    });
    if (authIdx < 0) {
      fail('Выбор отменён. Прервано.');
      process.exit(1);
    }
    auth = authIdx === 1 ? 'iam' : 'oauth';
  }

  // [3/5] Проверка ключей ---------------------------------------------------------

  step(3, 5, 'Проверка ключей в API Трекера');
  let account = null;
  try {
    const headers = {
      Authorization: auth === 'iam' ? `Bearer ${token}` : `OAuth ${token}`,
      'Content-Type': 'application/json',
    };
    headers[auth === 'iam' ? 'X-Cloud-Org-ID' : 'X-Org-ID'] = orgId;
    const res = await fetch('https://api.tracker.yandex.net/v3/myself', { headers });
    if (res.ok) {
      const me = await res.json();
      account = me.display ?? me.login ?? 'OK';
      const extra = me.email ? ` (${me.email})` : '';
      ok(`Авторизация работает: ${account}${extra}`);
    } else if (res.status === 401) {
      fail('401 Unauthorized — токен неверный или истёк (IAM живёт ≤12 часов).');
      if (!(await askYesNo(prompt, '  Продолжить всё равно?', false))) process.exit(1);
    } else if (res.status === 403) {
      fail('403 — неверный ID организации, нет доступа или Трекер не подключён к ней.');
      if (!(await askYesNo(prompt, '  Продолжить всё равно?', false))) process.exit(1);
    } else {
      warn(`Неожиданный ответ API: ${res.status}. Продолжаю.`);
    }
  } catch (error) {
    warn(`Не удалось связаться с API (${error.message}). Проверим при первом запуске агента.`);
  }

  // [4/5] Выбор клиента -------------------------------------------------------------

  step(4, 5, 'Для какого AI-клиента настраиваем?');
  const keys = Object.keys(CLIENTS);
  const clientItems = keys.map((key) => ({
    value: key,
    label: CLIENTS[key].title,
    description: CLIENTS[key].menu,
  }));

  // [5/5] Установка (+ цикл «ещё один клиент») ----------------------------------------

  const configured = [];
  for (;;) {
    const idx = await chooseFromList(prompt, {
      title: 'Клиент:',
      items: clientItems,
    });
    if (idx < 0) {
      warn('Выбор отменён — клиенты не настроены.');
      break;
    }
    const clientKey = clientItems[idx].value;
    ok(`Выбран: ${CLIENTS[clientKey].title}`);

    console.log('');
    const result = await installForClient(clientKey, { token, orgId, auth }, prompt);
    configured.push(result);

    if (!(await askYesNo(prompt, '  Настроить ещё один клиент?', false))) {
      break;
    }
  }

  // Сохранение ключей -----------------------------------------------------------------

  if (await askYesNo(prompt, '  Сохранить ключи в .env (чтобы не вводить в следующий раз)?')) {
    const lines = [
      '# traker-mcp: ключи Яндекс Трекера (файл в .gitignore)',
      `TRACKER_TOKEN=${token}`,
      `TRACKER_ORG_ID=${orgId}`,
    ];
    if (auth === 'iam') lines.push('TRACKER_AUTH=iam');
    writeFileSync(DOTENV, lines.join('\n') + '\n', { encoding: 'utf8' });
    ok(`Ключи сохранены: ${DOTENV}`);
  }

  // Отчёт -------------------------------------------------------------------------------

  console.log('');
  console.log(bold(green('═══════════════════════════════════════════════════════════════')));
  console.log(bold(green('  Установка завершена')));
  console.log(bold(green('═══════════════════════════════════════════════════════════════')));
  console.log('');
  console.log(`  Сервер:    ${SERVER_NAME}`);
  console.log(`  Команда:   ${process.execPath} ${INDEX_JS}`);
  console.log(`  Аккаунт:   ${account ?? 'не проверен'}`);
  console.log(`  Токен:     ${auth === 'iam' ? 'IAM (X-Cloud-Org-ID) — живёт ≤12 часов' : 'OAuth (X-Org-ID)'}`);
  console.log('');
  for (const entry of configured) {
    console.log(`  ${bold(entry.client)}`);
    for (const line of entry.report) {
      console.log(`    ${line}`);
    }
    console.log('');
  }
  console.log(bold('  Что дальше:'));
  console.log('    1. Полностью перезапустите настроенный клиент.');
  console.log('    2. Спросите у агента: «Вызови инструмент get_current_user» —');
  console.log('       вернётся ваш профиль Трекера, значит всё работает.');
  console.log('    3. Дальше: «Найди мои задачи в Трекере».');
  console.log('');
  console.log('  Подробности и решение проблем: docs/SETUP.md');
  console.log('');

  prompt.close();
}

// --- Установка под конкретного клиента --------------------------------------------

async function installForClient(clientKey, creds, prompt) {
  const env = {
    TRACKER_TOKEN: creds.token,
    TRACKER_ORG_ID: creds.orgId,
    ...(creds.auth === 'iam' ? { TRACKER_AUTH: 'iam' } : {}),
  };
  const stdioEntry = {
    command: process.execPath,
    args: [INDEX_JS],
    env,
  };

  const client = CLIENTS[clientKey];
  const report = [];
  let configuredFile = null;

  switch (clientKey) {
    case 'vscode': {
      const codeBin = resolveCommand('code');
      const json = JSON.stringify({ name: SERVER_NAME, type: 'stdio', ...stdioEntry });
      let done = false;
      if (codeBin) {
        const run = spawnSync(codeBin, ['--add-mcp', json], { shell: false, encoding: 'utf8' });
        done = run.status === 0;
      }
      if (done) {
        report.push('Добавлен через `code --add-mcp` в профиль пользователя.');
        report.push('Включить: чат Copilot → Configure Tools → yandex-tracker.');
      } else {
        report.push('CLI `code` не найден или вернул ошибку. Настройте вручную:');
        report.push('  палитра команд → MCP: Open User Configuration → вставьте:');
        report.push(
          JSON.stringify({ servers: { [SERVER_NAME]: { type: 'stdio', ...stdioEntry } } }, null, 2),
        );
      }
      break;
    }

    case 'cursor': {
      const result = upsertJsonConfig(path.join(HOME, '.cursor', 'mcp.json'), (config) => {
        config.mcpServers ??= {};
        config.mcpServers[SERVER_NAME] = { type: 'stdio', ...stdioEntry };
      });
      configuredFile = result.filePath;
      report.push(`Конфиг: ${result.filePath}`);
      if (result.backupPath) report.push(`Бэкап старого: ${result.backupPath}`);
      report.push('Проверка: полностью перезапустите Cursor, чат → список MCP.');
      break;
    }

    case 'claudeDesktop': {
      const result = upsertJsonConfig(claudeDesktopConfigPath(), (config) => {
        config.mcpServers ??= {};
        config.mcpServers[SERVER_NAME] = stdioEntry;
      });
      configuredFile = result.filePath;
      report.push(`Конфиг: ${result.filePath}`);
      if (result.backupPath) report.push(`Бэкап старого: ${result.backupPath}`);
      report.push('Важно: полностью перезапустите Claude Desktop (выйдите из приложения).');
      report.push('Проверка: чат → значок инструментов → 67 инструментов yandex-tracker.');
      break;
    }

    case 'claudeCode': {
      const claudeBin = resolveCommand('claude');
      let done = false;
      if (claudeBin) {
        const run = spawnSync(
          claudeBin,
          [
            'mcp',
            'add',
            '--transport',
            'stdio',
            SERVER_NAME,
            '--scope',
            'user',
            '-e',
            `TRACKER_TOKEN=${creds.token}`,
            '-e',
            `TRACKER_ORG_ID=${creds.orgId}`,
            ...(creds.auth === 'iam' ? ['-e', 'TRACKER_AUTH=iam'] : []),
            '--',
            process.execPath,
            INDEX_JS,
          ],
          { shell: false, encoding: 'utf8' },
        );
        done = run.status === 0;
        if (!done) {
          warn(`CLI вернул ошибку: ${(run.stderr || run.stdout || '').trim()}`);
        }
      }
      if (done) {
        report.push('Добавлен командой `claude mcp add` (scope: user).');
        report.push('Проверка: `claude mcp list` → ✔ Connected.');
      } else {
        report.push('Выполните вручную в терминале:');
        report.push(`  claude mcp add --transport stdio ${SERVER_NAME} --scope user \\`);
        report.push(`    -e TRACKER_TOKEN=<ваш-токен> -e TRACKER_ORG_ID=${creds.orgId} \\`);
        report.push(`    -- ${process.execPath} ${INDEX_JS}`);
      }
      break;
    }

    case 'opencode': {
      const result = upsertJsonConfig(
        path.join(HOME, '.config', 'opencode', 'opencode.json'),
        (config) => {
          config.$schema ??= 'https://opencode.ai/config.json';
          config.mcp ??= {};
          config.mcp[SERVER_NAME] = {
            type: 'local',
            command: [process.execPath, INDEX_JS],
            enabled: true,
            environment: env,
          };
        },
      );
      configuredFile = result.filePath;
      report.push(`Конфиг: ${result.filePath}`);
      if (result.backupPath) report.push(`Бэкап старого: ${result.backupPath}`);
      report.push('Проверка: перезапустите opencode, спросите «use the yandex-tracker tool».');
      break;
    }

    case 'windsurf': {
      const result = upsertJsonConfig(
        path.join(HOME, '.codeium', 'windsurf', 'mcp_config.json'),
        (config) => {
          config.mcpServers ??= {};
          config.mcpServers[SERVER_NAME] = stdioEntry;
        },
      );
      configuredFile = result.filePath;
      report.push(`Конфиг: ${result.filePath}`);
      if (result.backupPath) report.push(`Бэкап старого: ${result.backupPath}`);
      report.push('Проверка: перезапустите Windsurf, панель Cascade → доступные инструменты.');
      break;
    }

    case 'zed': {
      const result = upsertJsonConfig(zedSettingsPath(), (config) => {
        config.context_servers ??= {};
        config.context_servers[SERVER_NAME] = stdioEntry;
      });
      configuredFile = result.filePath;
      report.push(`Конфиг: ${result.filePath}`);
      if (result.backupPath) report.push(`Бэкап старого: ${result.backupPath}`);
      report.push('Учтите: в Zed command — строка, args — отдельный массив (уже так).');
      report.push('Проверка: Agent Panel → Settings → зелёная точка у yandex-tracker.');
      break;
    }

    case 'jetbrains': {
      const defaultDir = process.cwd();
      const dirAnswer = (
        await prompt.question(`  Папка проекта JetBrains [${defaultDir}]: `)
      ).trim();
      const projectDir = dirAnswer || defaultDir;
      const result = upsertJsonConfig(path.join(projectDir, '.mcp.json'), (config) => {
        config.mcpServers ??= {};
        config.mcpServers[SERVER_NAME] = stdioEntry;
      });
      configuredFile = result.filePath;
      report.push(`Конфиг: ${result.filePath}`);
      if (result.backupPath) report.push(`Бэкап старого: ${result.backupPath}`);
      report.push('Откройте проект в IDE → Settings → Tools → AI Assistant → MCP.');
      if (!existsSync(path.join(projectDir, '.gitignore'))) {
        warn(`Добавьте ${path.join(projectDir, '.mcp.json')} в .gitignore — там токен.`);
      }
      break;
    }

    default:
      report.push('Неизвестный клиент.');
  }

  if (configuredFile) {
    warn(`Файл содержит токен в открытом виде: ${configuredFile}`);
  }
  return { client: client.title, report };
}

main().catch((error) => {
  console.error(`${red('Ошибка:')} ${error.message}`);
  process.exit(1);
});
