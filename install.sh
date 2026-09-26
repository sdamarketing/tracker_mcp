#!/usr/bin/env bash
#
# traker-mcp · Установщик Яндекс Трекера для AI-агентов
#
# Установка (macOS / Linux / WSL):
#   curl -fsSL https://raw.githubusercontent.com/sdamarketing/tracker_mcp/main/install.sh | bash
#
# Повторный запуск той же командой = обновление сервера.
# Перед | bash скрипт можно прочитать: уберите «| bash» и посмотрите вывод.
# Скрипт выполняется от обычного пользователя; sudo не нужен.
#
# Переменные окружения (все необязательные):
#   TRAKER_INSTALL_DIR  — куда ставить (по умолчанию ~/.traker-mcp)
#   TRAKER_NO_WIZARD=1   — не запускать мастер настройки в конце
#
set -euo pipefail

REPO_URL="${TRAKER_REPO_URL:-https://github.com/sdamarketing/tracker_mcp.git}"
NVM_INSTALL_URL="https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh"
NODE_MAJOR_MIN="20"
INSTALL_DIR="${TRAKER_INSTALL_DIR:-$HOME/.traker-mcp}"

# --- Оформление --------------------------------------------------------------

if command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  C_CYAN=$'\033[36m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'
  C_BOLD=$'\033[1m'; C_OFF=$'\033[0m'
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BOLD=""; C_OFF=""
fi

say()   { printf '%s\n' "${C_BOLD}$*${C_OFF}"; }
step()  { printf '\n%s\n' "${C_BOLD}${C_CYAN}==>${C_OFF} ${C_BOLD}$*${C_OFF}"; }
ok()    { printf '  %s %s\n' "${C_GREEN}✔${C_OFF}" "$*"; }
warn()  { printf '  %s %s\n' "${C_YELLOW}⚠${C_OFF}" "$*"; }
die()   { printf '  %s %s\n' "${C_RED}✖${C_OFF}" "$*" >&2; exit 1; }

# Интерактив: при «curl | bash» стандартный ввод занят пайпом, поэтому всё
# читаем напрямую с терминала через /dev/tty.
TTY_OK="no"
if (exec 3< /dev/tty) 2>/dev/null; then
  TTY_OK="yes"
fi

ask_yes_no() { # $1: вопрос; stdin: терминал; stdout: "yes" | "no"
  local answer
  if [ "$TTY_OK" != "yes" ]; then
    return 1
  fi
  printf '%s [Y/n] ' "$1" >&2
  while :; do
    if ! IFS= read -r answer < /dev/tty; then
      return 1
    fi
    answer=$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')
    case "$answer" in
      ""|y|yes|да|д) return 0 ;;
      n|no|нет|н)    return 1 ;;
      *) printf '  Введите «y» или «n»: ' >&2 ;;
    esac
  done
}

# --- Проверки ----------------------------------------------------------------

step 'Проверка системы'

case "$(uname -s)" in
  Linux) OS="linux" ;;
  Darwin) OS="macos" ;;
  *) die 'Поддерживаются macOS, Linux и WSL. Для Windows: docs/SETUP.md (ручная установка).' ;;
esac
ok "$(uname -sm)"

[ -n "${HOME:-}" ] || die 'Не задан HOME — запустите из обычного терминала.'

command -v curl >/dev/null 2>&1 || die 'Не найден curl. Установите его и повторите.'
command -v git  >/dev/null 2>&1 || die 'Не найден git. Установите его (https://git-scm.com) и повторите.'

# --- Node.js -----------------------------------------------------------------

step 'Проверка Node.js'

node_major() {
  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0'
}

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node_major)"
  if [ "$NODE_MAJOR" -ge "$NODE_MAJOR_MIN" ]; then
    ok "Node.js $(node -v) — подходит (нужна ${NODE_MAJOR_MIN}+)"
  else
    warn "Найден Node.js $(node -v), нужен ${NODE_MAJOR_MIN}+. Установлю свежий Node через nvm."
    NODE_INSTALL_NEEDED="yes"
  fi
else
  warn 'Node.js не найден.'
  NODE_INSTALL_NEEDED="yes"
fi

if [ "${NODE_INSTALL_NEEDED:-no}" = "yes" ]; then
  if ! ask_yes_no 'Установить Node.js LTS через nvm (без sudo, в ~/.nvm)?'; then
    die 'Без Node.js установка невозможна. Установите его с nodejs.org и повторите.'
  fi

  NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    say '  Устанавливаю nvm…'
    curl -fsSL "$NVM_INSTALL_URL" | bash || die 'Не удалось установить nvm.'
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" || die 'nvm установился, но не загрузился. Откройте новый терминал и повторите.'
  say '  Устанавливаю Node.js LTS (скачивается ~30 МБ)…'
  nvm install --lts || die 'Не удалось установить Node.js через nvm.'
  ok "Установлен Node.js v$(node -v) через nvm"
fi

NODE_MAJOR="$(node_major)"
[ "$NODE_MAJOR" -ge "$NODE_MAJOR_MIN" ] || die "Node.js v$(node -v) слишком старый, нужна ${NODE_MAJOR_MIN}+."

# --- Загрузка репозитория ------------------------------------------------------

step 'Загрузка traker-mcp'

if [ -d "$INSTALL_DIR/.git" ]; then
  say "  Ранее установлен: $INSTALL_DIR — обновляю до последней версии…"
  git -C "$INSTALL_DIR" fetch --quiet origin \
    || die 'Не удалось обновить (нет сети?). Проверьте интернет и повторите.'
  git -C "$INSTALL_DIR" reset --quiet --hard origin/main
  ok 'Код обновлён (локальные изменения в этой папке сброшены)'
elif [ -e "$INSTALL_DIR" ]; then
  die "Папка $INSTALL_DIR уже существует и это не копия репозитория.
  Удалите её или задайте другую: TRAKER_INSTALL_DIR=~/traker-mcp bash install.sh"
else
  git clone --quiet --depth 1 "$REPO_URL" "$INSTALL_DIR" \
    || die 'Не удалось склонировать репозиторий. Проверьте доступ к github.com.'
  ok "Скачан в $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# --- Сборка ---------------------------------------------------------------------

step 'Сборка сервера'

say '  npm install (занимает 10–30 секунд)…'
npm install --no-fund --no-audit --loglevel=error </dev/null || die 'npm install не удался.'
npm run build --silent </dev/null || die 'Сборка не удалась.'

ok 'Собрано'

# --- Проверка --------------------------------------------------------------------

step 'Проверка сервера'

if SMOKE_OUT="$(npm run smoke --silent </dev/null)"; then
  ok "$SMOKE_OUT"
else
  die 'Сервер собрался, но тест не прошёл. Сообщите в issues: github.com/sdamarketing/tracker_mcp'
fi

# --- Мастер настройки ---------------------------------------------------------------

step 'Настройка AI-клиента'

if [ "${TRAKER_NO_WIZARD:-0}" = "1" ]; then
  warn 'Мастер пропущен (TRAKER_NO_WIZARD=1).'
  RUN_WIZARD="no"
elif [ "$TTY_OK" = "yes" ]; then
  RUN_WIZARD="yes"
else
  warn 'Нет интерактивного терминала — мастер настройки запустите сами.'
  RUN_WIZARD="no"
fi

if [ "$RUN_WIZARD" = "yes" ]; then
  # stdin = /dev/tty: внутри мастера скрытый ввод токена работает как положено.
  if node scripts/setup.mjs < /dev/tty; then
    WIZARD_DONE="yes"
  else
    warn 'Мастер завершился с ошибкой — конфиг можно настроить позже.'
    WIZARD_DONE="no"
  fi
else
  WIZARD_DONE="no"
fi

# --- Итог -------------------------------------------------------------------------------

printf '\n'
printf '%s\n' "${C_BOLD}${C_GREEN}═══════════════════════════════════════════════════════════════${C_OFF}"
printf '%s\n' "${C_BOLD}${C_GREEN}  Установка завершена${C_OFF}"
printf '%s\n' "${C_BOLD}${C_GREEN}═══════════════════════════════════════════════════════════════${C_OFF}"
printf '\n'
printf '  Папка:     %s\n' "$INSTALL_DIR"
printf '  Сервер:    %s\n' "node $INSTALL_DIR/dist/index.js"
if [ "$WIZARD_DONE" = "yes" ]; then
  printf '  Настройка: выполнена мастером (см. отчёт выше)\n'
else
  printf '%s\n' "${C_BOLD}  Настройте AI-клиента командой:${C_OFF}"
  printf '      cd %s && npm run setup\n' "$INSTALL_DIR"
fi
printf '\n'
printf '  Обновление: той же командой\n'
printf '      curl -fsSL https://raw.githubusercontent.com/sdamarketing/tracker_mcp/main/install.sh | bash\n'
printf '\n'
printf '  Документация: %s\n' "$INSTALL_DIR/docs/SETUP.md"
printf '\n'
