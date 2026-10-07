#!/usr/bin/env node
// CLI wrapper for the npm-installed package.
//   tracker-mcp            → start the MCP server (stdio)
//   tracker-mcp setup      → interactive setup wizard (keys + AI client config)
//   tracker-mcp update     → self-update
//   tracker-mcp links      → generate personal install links (install-links.html)
//   tracker-mcp --version / --help

import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const [cmd] = process.argv.slice(2);

if (cmd === '--version' || cmd === '-v') {
  console.log(pkg.version);
  process.exit(0);
}
if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
  console.log(`tracker-mcp v${pkg.version} — MCP-сервер для Яндекс Трекера

Использование:
  tracker-mcp            запустить MCP-сервер (stdio, нужен TRACKER_TOKEN/TRACKER_ORG_ID)
  tracker-mcp serve      HTTP-сервер: --port 3407 (по умолчанию), --host 127.0.0.1,
                         ключ доступа к эндпоинту: env MCP_AUTH_TOKEN (Bearer),
                         без него разрешён только loopback
  tracker-mcp setup      интерактивный мастер: ключи Трекера + настройка AI-клиента
  tracker-mcp update     обновить установленную копию (git-клон) и скилл
  tracker-mcp links      сгенерировать install-links.html с кнопками «в один клик»
  tracker-mcp --version  версия
  tracker-mcp --help     эта справка

Документация: https://github.com/sdamarketing/tracker_mcp`);
  process.exit(0);
}

const targets = {
  setup: path.join(root, 'scripts', 'setup.mjs'),
  update: path.join(root, 'scripts', 'self-update.mjs'),
  links: path.join(root, 'scripts', 'generate-install-links.mjs'),
  serve: path.join(root, 'dist', 'serve.js'),
};

const script = cmd ? targets[cmd] : path.join(root, 'dist', 'index.js');
if (cmd && !script) {
  console.error(`Неизвестная команда: ${cmd}\nСправка: tracker-mcp --help`);
  process.exit(1);
}

// Дочерний процесс с наследованием stdio — код выхода пробрасываем наружу.
const child = spawn(process.execPath, [script, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
