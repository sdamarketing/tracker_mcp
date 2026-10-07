#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const { server } = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(`traker-mcp failed to start: ${message}\n`);
  process.exit(1);
});
