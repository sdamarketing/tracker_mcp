#!/usr/bin/env node
/**
 * HTTP entry: `tracker-mcp serve --port 3407 [--host 127.0.0.1]`
 *
 * Streamable HTTP transport (stateless): one `McpServer` instance bound to a
 * stateless WebStandardStreamableHTTPServerTransport; every request is a
 * self-contained JSON-RPC call. Tracker credentials come from the process env
 * (TRACKER_TOKEN / TRACKER_ORG_ID / TRACKER_AUTH), so the HTTP endpoint itself
 * needs its own gate: set MCP_AUTH_TOKEN to require `Authorization: Bearer …`.
 * Without MCP_AUTH_TOKEN the listener refuses to bind to non-loopback hosts.
 */

import { createServer, type IncomingMessage } from 'node:http';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { buildServer } from './server.js';

function parseArgs(argv: string[]): { port: number; host: string } {
  let port = Number(process.env.PORT || 3407);
  let host = process.env.HOST || '127.0.0.1';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.split('=', 2);
    const take = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[++i];
      if (!next) throw new Error(`Missing value for ${arg}`);
      return next;
    };
    if (flag === '--port' || flag === '-p') {
      port = Number(take());
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error(`Invalid --port: ${port}`);
    } else if (flag === '--host' || flag === '-H') {
      host = take();
    } else {
      throw new Error(`Unknown argument: ${arg} (supported: --port, --host)`);
    }
  }
  return { port, host };
}

const isLoopback = (host: string): boolean =>
  host === '127.0.0.1' || host === '::1' || host === 'localhost';

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE')
    return new Request(url, { method: req.method ?? 'GET', headers });
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  return new Request(url, {
    method: req.method ?? 'POST',
    headers,
    body: body.length > 0 ? body : undefined,
  });
}

async function sendWebResponse(
  res: import('node:http').ServerResponse,
  response: Response,
): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body === null) {
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

const jsonResponse = (res: import('node:http').ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

async function main(): Promise<void> {
  const { port, host } = parseArgs(process.argv.slice(2));
  const authToken = process.env.MCP_AUTH_TOKEN || '';

  if (!authToken && !isLoopback(host)) {
    throw new Error(
      `MCP_AUTH_TOKEN is required when binding to '${host}'. ` +
        'Without it the HTTP endpoint is unauthenticated while your Tracker credentials live in env. ' +
        'Either set MCP_AUTH_TOKEN or bind to 127.0.0.1 (default).',
    );
  }

  const { server, registered } = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session headers, each POST is a complete exchange.
    // All HTTP clients share this single server instance — per-user Tracker
    // credentials are not supported here by design (run one process per user).
    sessionIdGenerator: undefined,
    enableJsonResponse: false, // prefer SSE per the Streamable HTTP spec
  });
  await server.connect(transport);

  const http = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({ ok: true, server: 'yandex-tracker', tools: registered }),
        );
        return;
      }

      if (url.pathname !== '/mcp') {
        jsonResponse(res, 404, {
          error: `Not found: ${url.pathname}. MCP endpoint is /mcp, probe is /health.`,
        });
        return;
      }

      if (authToken) {
        const header = req.headers.authorization ?? '';
        if (header !== `Bearer ${authToken}`) {
          res.writeHead(401, { 'www-authenticate': 'Bearer realm="tracker-mcp"' });
          res.end(JSON.stringify({ error: 'Missing or invalid MCP_AUTH_TOKEN (want: Authorization: Bearer <token>)' }));
          return;
        }
      }

      const webReq = await toWebRequest(req);
      const webRes = await transport.handleRequest(webReq);
      await sendWebResponse(res, webRes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`tracker-mcp serve: request failed: ${message}\n`);
      if (!res.headersSent) jsonResponse(res, 500, { error: message });
      else res.end();
    }
  });

  http.listen(port, host, () => {
    process.stderr.write(
      `tracker-mcp serve: http://${host}:${port}/mcp (stateless, ${registered} tools` +
        `${authToken ? ', bearer auth' : ', NO auth token — loopback only'})\n`,
    );
  });

  const shutdown = () => http.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(`traker-mcp failed to start: ${message}\n`);
  process.exit(1);
});
