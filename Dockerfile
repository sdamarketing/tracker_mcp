# tracker-mcp — образ сервера Яндекс Трекера (YTMCP-2)
#   docker build -t ghcr.io/sdamarketing/tracker-mcp .
#   stdio:  docker run -i --rm -e TRACKER_TOKEN -e TRACKER_ORG_ID ghcr.io/sdamarketing/tracker-mcp
#   HTTP:   docker run --rm -p 3407:3407 -e TRACKER_TOKEN -e TRACKER_ORG_ID \
#             -e MCP_AUTH_TOKEN=… ghcr.io/sdamarketing/tracker-mcp serve --host 0.0.0.0

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Ownership-метки для Official MCP Registry (io.modelcontextprotocol.server.name)
# и привязки пакета к репо на ghcr (org.opencontainers.image.source)
LABEL io.modelcontextprotocol.server.name="io.github.sdamarketing/tracker-mcp" \
      org.opencontainers.image.source="https://github.com/sdamarketing/tracker_mcp"

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit && npm cache clean --force

# bin-обёртка даёт подкоманды (serve/setup/links); src не нужен, только dist
COPY --from=build /app/dist ./dist
COPY bin ./bin
COPY scripts ./scripts
COPY LICENSE README.md ./

# мастер/setup требуют TTY и браузер — в контейнере полезен сам сервер
EXPOSE 3407
USER node

ENTRYPOINT ["node", "bin/tracker-mcp.mjs"]
# Без аргументов — stdio-сервер (дефолт для MCP-клиентов). С аргументом: serve / setup / links.
