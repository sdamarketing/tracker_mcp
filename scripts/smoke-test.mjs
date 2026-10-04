// Smoke test: spawns the built server over stdio, speaks raw JSON-RPC,
// and verifies that initialize succeeds and all expected tools are listed.
// Usage: node scripts/smoke-test.mjs

import { spawn } from 'node:child_process';

const EXPECTED_TOOLS = [
  // issues
  'find_issues', 'count_issues', 'create_issue', 'get_issue', 'edit_issue',
  'move_issue', 'get_issue_transitions', 'execute_transition', 'get_issue_links',
  'create_issue_link', 'delete_issue_link', 'get_issue_changelog',
  // comments / checklists / worklog / attachments
  'add_comment', 'get_issue_comments', 'edit_comment', 'delete_comment',
  'get_checklist', 'add_checklist_item', 'edit_checklist_item', 'delete_checklist_item',
  'get_issue_worklog', 'add_worklog_record', 'edit_worklog_record', 'delete_worklog_record',
  'list_issue_attachments', 'upload_issue_attachment', 'delete_issue_attachment',
  // bulk
  'bulk_update_issues', 'bulk_move_issues', 'bulk_transition_issues', 'get_bulk_operation_info',
  // queues
  'get_queues', 'get_queue', 'create_queue', 'get_queue_fields', 'get_queue_versions',
  'create_queue_version', 'get_queue_components', 'create_component', 'get_queue_local_fields',
  'get_queue_macroses', 'get_queue_tags', 'get_queue_triggers', 'get_queue_autoactions',
  // boards / dashboards / projects / entities
  'get_boards', 'get_board', 'get_board_columns', 'get_board_sprints',
  'create_board', 'create_dashboard', 'create_cycle_time_widget',
  'get_projects', 'get_project', 'create_project', 'update_project', 'delete_project',
  'search_entities', 'get_entity', 'create_entity', 'update_entity', 'delete_entity',
  'add_entity_comment', 'get_entity_comments',
  // users / catalogs
  'get_current_user', 'get_user', 'get_users',
  'get_issue_types', 'get_statuses', 'get_priorities', 'get_resolutions', 'get_issue_fields',
];

function rpc(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

function main() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/index.js'], {
      env: {
        ...process.env,
        TRACKER_TOKEN: 'smoke-test-fake-token',
        TRACKER_ORG_ID: '12345678',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    const responses = new Map();
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined) {
            responses.set(message.id, message);
          }
        } catch {
          reject(new Error(`Non-JSON line on stdout: ${line.slice(0, 200)}`));
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('exit', (code) => {
      if (code !== 0 && responses.size === 0) {
        reject(new Error(`Server exited early with code ${code}. Stderr: ${stderr}`));
      }
    });

    function waitFor(id, attempts = 100) {
      return new Promise((res, rej) => {
        const check = (n) => {
          if (responses.has(id)) return res(responses.get(id));
          if (n <= 0) return rej(new Error(`Timed out waiting for response to request ${id}. Stderr: ${stderr}`));
          setTimeout(() => check(n - 1), 100);
        };
        check(attempts);
      });
    }

    async function run() {
      child.stdin.write(rpc(1, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'smoke-test', version: '0.0.0' },
      }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const init = await waitFor(1);
      if (init.error) {
        throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
      }

      child.stdin.write(rpc(2, 'tools/list', {}) + '\n');
      const tools = await waitFor(2);
      if (tools.error) {
        throw new Error(`tools/list failed: ${JSON.stringify(tools.error)}`);
      }
      const names = tools.result.tools.map((tool) => tool.name);
      const missing = EXPECTED_TOOLS.filter((name) => !names.includes(name));
      const extra = names.filter((name) => !EXPECTED_TOOLS.includes(name));

      child.kill();

      if (missing.length) {
        throw new Error(`Missing tools: ${missing.join(', ')}\nGot: ${names.join(', ')}`);
      }
      if (extra.length) {
        throw new Error(`Unexpected extra tools: ${extra.join(', ')}`);
      }
      console.log(`OK: server initialized, protocol ${init.result.protocolVersion}, ${names.length} tools listed.`);
      resolve();
    }

    run().catch((err) => {
      child.kill();
      reject(err);
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
