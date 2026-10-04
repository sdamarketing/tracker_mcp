#!/usr/bin/env node
// Detects drift between the server's tool registry and the official Tracker API docs.
// The docs index (llms.txt) list of /api/* pages is snapshotted in
// tests/api-docs-snapshot.txt. If Yandex adds/removes endpoints, this script fails
// and the snapshot + tools should be reviewed.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = path.join(root, 'tests/api-docs-snapshot.txt');

if (process.argv.includes('--update')) {
  const live = await fetchApiPages();
  const { writeFileSync } = await import('node:fs');
  writeFileSync(snapshotPath, live.join('\n') + '\n');
  console.log(`snapshot updated: ${live.length} pages`);
  process.exit(0);
}

const live = await fetchApiPages();
const snapshot = readFileSync(snapshotPath, 'utf8').trim().split('\n').sort();

const added = live.filter((p) => !snapshot.includes(p));
const removed = snapshot.filter((p) => !live.includes(p));

if (added.length || removed.length) {
  console.error('API docs drift detected!');
  for (const p of added) console.error('  + new in docs:  ', p);
  for (const p of removed) console.error('  - gone from docs:', p);
  console.error('\nReview the changes, update tools if needed, then run: npm run docs:update');
  process.exit(1);
}
console.log(`docs in sync: ${live.length} API pages, no drift`);

async function fetchApiPages() {
  const res = await fetch('https://yandex.ru/support/tracker/ru/llms.txt');
  if (!res.ok) throw new Error(`llms.txt fetch failed: ${res.status}`);
  const text = await res.text();
  const matches = text.match(/https:\/\/yandex\.ru\/support\/tracker\/ru\/api\/[a-z0-9/_-]+\.md/g) ?? [];
  return [...new Set(matches)].sort();
}
