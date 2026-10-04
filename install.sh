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
#   TRAKER_NO_WIZARD=1  — не запускать мастер настройки в конце
#
set -euo pipefail

VERSION="0.1.0"
AUTHOR="Александр Хмара (@sdamarketing)"
REPO_URL="${TRAKER_REPO_URL:-https://github.com/sdamarketing/tracker_mcp.git}"
REPO_PUBLIC_URL="github.com/sdamarketing/tracker_mcp"
NVM_INSTALL_URL="https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh"
NODE_MAJOR_MIN="20"
INSTALL_DIR="${TRAKER_INSTALL_DIR:-$HOME/.traker-mcp}"

# --- Оформление ----------------------------------------------------------------

if command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  C_CYAN=$'\033[36m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BOLD=""; C_DIM=""; C_OFF=""
fi
TRUECOLOR="no"
if [ "${COLORTERM:-}" = "truecolor" ] || [ "${COLORTERM:-}" = "24bit" ]; then
  TRUECOLOR="yes"
fi

say()   { printf '%s\n' "${C_BOLD}$*${C_OFF}"; }
ok()    { printf '  %s %s\n' "${C_GREEN}✔${C_OFF}" "$*"; }
warn()  { printf '  %s %s\n' "${C_YELLOW}⚠${C_OFF}" "$*"; }
die()   { printf '  %s %s\n' "${C_RED}✖${C_OFF}" "$*" >&2; exit 1; }

# --- Баннер ----------------------------------------------------------------------

# Арт «TRAKER MCP» (figlet-style). Хранится через heredoc: в строках есть
# бэктики, апострофы и обратные слеши — их нельзя экранировать в кавычках.
ART_ROWS=()
while IFS= read -r __banner_line; do ART_ROWS+=("$__banner_line"); done << 'TRAKER_BANNER_EOF'
__     __             _        _______             _
\ \   / /            | |      |__   __|           | |
 \ \_/ /_ _ _ __   __| | ___     | |_ __ __ _  ___| | _____ _ __
  \   / _` | '_ \ / _` |/ _ \    | | '__/ _` |/ __| |/ / _ \ '__|
   | | (_| | | | | (_| |  __/    | | | | (_| | (__|   <  __/ |
   |_|\__,_|_| |_|\__,_|\___|    |_|_|  \__,_|\___|_|\_\___|_|
TRAKER_BANNER_EOF

BANNER_INFO=(
  "v${VERSION} · MCP-сервер для Яндекс Трекера"
  "Автор: ${AUTHOR}"
  "Исходники: ${REPO_PUBLIC_URL}"
)

# Отображаемая ширина строки (wc -m учитывает кириллицу в UTF-8 локали).
dispw() { printf '%s' "$1" | wc -m; }

# Горизонтальный градиент мята → перванш по столбцам (truecolor).
gradient() {
  local s="$1"
  if [ "$TRUECOLOR" != "yes" ]; then
    printf '%s%s%s' "$C_CYAN" "$s" "$C_OFF"
    return
  fi
  local len=${#s} x r g b
  local denom=$((len > 1 ? len - 1 : 1))
  for ((x = 0; x < len; x++)); do
    r=$((34 + (129 - 34) * x / denom))
    g=$((197 + (140 - 197) * x / denom))
    b=$((94 + (248 - 94) * x / denom))
    printf '\033[38;2;%d;%d;%dm%s' "$r" "$g" "$b" "${s:x:1}"
  done
  printf '%s' "$C_OFF"
}

banner() {
  local max=0 line w padl padr i hbar
  for line in "${ART_ROWS[@]}"; do w=${#line}; [ "$w" -gt "$max" ] && max=$w; done
  for line in "${BANNER_INFO[@]}"; do w=$(dispw "$line"); [ "$w" -gt "$max" ] && max=$w; done
  hbar=""
  for ((i = 0; i < max + 2; i++)); do hbar+="─"; done

  printf '\n'
  printf '  %s┌%s┐%s\n' "$C_DIM" "$hbar" "$C_OFF"
  for line in "${ART_ROWS[@]}"; do
    printf '  %s│%s ' "$C_DIM" "$C_OFF"
    gradient "$line"
    printf '%*s' $((max - ${#line})) ''
    printf ' %s│%s\n' "$C_DIM" "$C_OFF"
  done
  printf '  %s│%*s│%s\n' "$C_DIM" $((max + 2)) '' "$C_OFF"
  for line in "${BANNER_INFO[@]}"; do
    w=$(dispw "$line")
    padl=$(((max - w) / 2 + 1))
    [ "$padl" -lt 1 ] && padl=1
    padr=$((max + 2 - padl - w))
    [ "$padr" -lt 1 ] && padr=1
    printf '  %s│%s' "$C_DIM" "$C_OFF"
    printf '%*s' "$padl" ''
    printf '%s%s%s' "$C_BOLD" "$line" "$C_OFF"
    printf '%*s' "$padr" ''
    printf '%s│%s\n' "$C_DIM" "$C_OFF"
  done
  printf '  %s└%s┘%s\n' "$C_DIM" "$hbar" "$C_OFF"
  printf '\n'
}

# --- Спиннер ---------------------------------------------------------------------

# spin "Сообщение" -- команда аргументы…
# Вывод команды прячет в лог; при ошибке показывает его конец.
spin() {
  local msg="$1"; shift
  [ "${1:-}" = "--" ] && shift
  local log; log="$(mktemp)"
  local -a frames=( '⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏' )
  local i=0 pid
  "$@" >"$log" 2>&1 &
  pid=$!
  if [ -t 1 ]; then
    while kill -0 "$pid" 2>/dev/null; do
      printf '\r  %s%s%s %s' "$C_CYAN" "${frames[$((i % 10))]}" "$C_OFF" "$msg"
      i=$((i + 1))
      sleep 0.08
    done
  else
    printf '  … %s\n' "$msg"
  fi
  if wait "$pid"; then
    if [ -t 1 ]; then printf '\r'; fi
    ok "$msg"
    rm -f "$log"
  else
    local rc=$?
    if [ -t 1 ]; then printf '\r'; fi
    printf '  %s %s\n' "${C_RED}✖${C_OFF}" "$msg" >&2
    tail -n 15 "$log" >&2
    rm -f "$log"
    return "$rc"
  fi
}

# --- Интерактив -------------------------------------------------------------

TTY_OK="no"
if (exec 3< /dev/tty) 2>/dev/null; then
  TTY_OK="yes"
fi

ask_yes_no() { # $1: вопрос; ответ через /dev/tty
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

# --- Установка ----------------------------------------------------------------

banner

say "  Устанавливаю в ${INSTALL_DIR}"
printf '\n'

# Проверки
[ -n "${HOME:-}" ] || die 'Не задан HOME — запустите из обычного терминала.'
command -v curl >/dev/null 2>&1 || die 'Не найден curl. Установите его и повторите.'
command -v git  >/dev/null 2>&1 || die 'Не найден git. Установите его (https://git-scm.com) и повторите.'
case "$(uname -s)" in
  Linux) OS="linux" ;;
  Darwin) OS="macos" ;;
  *) die 'Поддерживаются macOS, Linux и WSL. Для Windows: docs/SETUP.md (ручная установка).' ;;
esac

# Node.js
node_major() {
  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0'
}

NODE_INSTALL_NEEDED="no"
if command -v node >/dev/null 2>&1; then
  if [ "$(node_major)" -ge "$NODE_MAJOR_MIN" ]; then
    ok "Node.js $(node -v) — подходит (нужна ${NODE_MAJOR_MIN}+)"
  else
    warn "Найден Node.js $(node -v), нужен ${NODE_MAJOR_MIN}+."
    NODE_INSTALL_NEEDED="yes"
  fi
else
  NODE_INSTALL_NEEDED="yes"
fi

if [ "$NODE_INSTALL_NEEDED" = "yes" ]; then
  if ! ask_yes_no 'Установить Node.js LTS через nvm (без sudo, в ~/.nvm)?'; then
    die 'Без Node.js установка невозможна. Установите его с nodejs.org и повторите.'
  fi
  NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    spin 'Устанавливаю nvm' -- bash -c "curl -fsSL '$NVM_INSTALL_URL' | bash"
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" || die 'nvm установился, но не загрузился. Откройте новый терминал и повторите.'
  spin 'Устанавливаю Node.js LTS (~30 МБ)' -- nvm install --lts
  ok "Установлен Node.js $(node -v) через nvm"
fi

[ "$(node_major)" -ge "$NODE_MAJOR_MIN" ] || die "Node.js $(node -v) слишком старый, нужна ${NODE_MAJOR_MIN}+."

# Загрузка
if [ -d "$INSTALL_DIR/.git" ]; then
  say "  Ранее установлен: $INSTALL_DIR — обновляю до последней версии"
  spin 'Обновляю код' -- git -C "$INSTALL_DIR" fetch --quiet origin
  git -C "$INSTALL_DIR" reset --quiet --hard origin/main
  ok "Код обновлён (локальные изменения в этой папке сброшены)"
elif [ -e "$INSTALL_DIR" ]; then
  die "Папка $INSTALL_DIR уже существует и это не копия репозитория.
  Удалите её или задайте другую: TRAKER_INSTALL_DIR=~/traker-mcp bash install.sh"
else
  spin "Скачиваю traker-mcp в $INSTALL_DIR" -- git clone --quiet --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Сверка версии
ACTUAL_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo '?')"
if [ "$ACTUAL_VERSION" != "$VERSION" ] && [ "$ACTUAL_VERSION" != "?" ]; then
  VERSION="$ACTUAL_VERSION"
  warn "Версия в репозитории отличается: устанавливаю v$VERSION"
fi

# Сборка
spin 'Ставлю зависимости (npm install)' -- npm install --no-fund --no-audit --loglevel=error
spin 'Собираю сервер' -- npm run build --silent
SMOKE_OUT="$(npm run smoke --silent </dev/null)" || die 'Сервер собрался, но тест не прошёл. Сообщите в issues: github.com/sdamarketing/tracker_mcp'
ok "$SMOKE_OUT"

# Мастер настройки
if [ "${TRAKER_NO_WIZARD:-0}" = "1" ]; then
  warn 'Мастер пропущен (TRAKER_NO_WIZARD=1).'
  WIZARD_DONE="no"
elif [ "$TTY_OK" = "yes" ]; then
  printf '\n'
  say 'Мастер настройки: ключи Трекера и выбор AI-клиента'
  if node scripts/setup.mjs < /dev/tty; then
    WIZARD_DONE="yes"
  else
    warn 'Мастер завершился с ошибкой — конфиг можно настроить позже.'
    WIZARD_DONE="no"
  fi
else
  warn 'Нет интерактивного терминала — мастер настройки запустите сами.'
  WIZARD_DONE="no"
fi

# --- Итог ----------------------------------------------------------------------

printf '\n'
printf '%s\n' "${C_BOLD}${C_GREEN}═══════════════════════════════════════════════════════════════${C_OFF}"
printf '%s\n' "${C_BOLD}${C_GREEN}  traker-mcp v${VERSION} — установка завершена${C_OFF}"
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
printf '  %sДокументация: %s/docs/SETUP.md%s\n' "$C_DIM" "$INSTALL_DIR" "$C_OFF"
printf '  %sПроблемы:     github.com/sdamarketing/tracker_mcp/issues%s\n\n' "$C_DIM" "$C_OFF"
