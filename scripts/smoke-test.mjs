// Smoke test: spawns the built server over stdio, speaks raw JSON-RPC,
// and verifies that initialize succeeds and all expected tools are listed.
// Usage: node scripts/smoke-test.mjs

import { spawn } from 'node:child_process';

// Дымовой тест: сервер стартует по stdio, отдаёт initialize и полный список
// инструментов. Список ниже — контракт: ловит случайное удаление/переименование.
// Поддерживайте вручную при добавлении инструментов.

// Дымовой тест: сервер стартует по stdio, отдаёт initialize и полный список
// инструментов. Список ниже — контракт: ловит случайное удаление/переименование.
// Поддерживайте вручную при добавлении инструментов.

const EXPECTED_TOOLS = [
  'find_issues',
  'count_issues',
  'create_issue',
  'get_issue',
  'edit_issue',
  'move_issue',
  'get_issue_transitions',
  'execute_transition',
  'get_issue_links',
  'create_issue_link',
  'delete_issue_link',
 'download_entity_attachment',
  'get_issue_changelog',
  'release_search_scroll',
  'add_comment',
  'get_issue_comments',
  'get_issue_comment',
  'edit_comment',
  'delete_comment',
  'add_comment_reaction',
  'get_checklist',
  'add_checklist_item',
  'edit_checklist_item',
  'delete_checklist_item',
  'delete_checklist',
  'get_issue_worklog',
  'add_worklog_record',
  'edit_worklog_record',
  'delete_worklog_record',
  'find_worklog_records',
  'list_issue_attachments',
  'get_issue_attachment',
  'download_issue_attachment',
  'get_attachment_thumbnail',
  'upload_issue_attachment',
  'upload_temp_attachment',
  'delete_issue_attachment',
  'bulk_update_issues',
  'bulk_move_issues',
  'bulk_transition_issues',
  'get_bulk_operation_info',
  'create_issue_report',
  'find_issue_reports',
  'get_search_suggest',
  'get_issue_fields',
  'get_issue_field',
  'create_issue_field',
  'update_issue_field',
  'create_issue_field_category',
  'update_issue_field_category',
  'get_external_applications',
  'get_external_links',
  'create_external_link',
  'delete_external_link',
  'create_filter',
  'get_filter',
  'update_filter',
  'delete_filter',
  'get_queues',
  'get_queue',
  'create_queue',
  'get_queue_fields',
  'get_queue_versions',
  'create_queue_version',
  'get_queue_version',
  'update_queue_version',
  'delete_queue_version',
  'get_queue_components',
  'create_component',
  'get_components',
  'get_component',
  'update_component',
  'delete_component',
  'get_component_user_access',
  'get_component_group_access',
  'get_queue_local_fields',
  'get_queue_local_field',
  'create_queue_local_field',
  'update_queue_local_field',
  'get_queue_macroses',
  'get_queue_macro',
  'create_queue_macro',
  'update_queue_macro',
  'delete_queue_macro',
  'get_queue_tags',
  'delete_queue_tag',
  'get_queue_triggers',
  'get_queue_trigger',
  'create_queue_trigger',
  'update_queue_trigger',
  'get_queue_trigger_logs',
  'get_queue_autoactions',
  'get_queue_autoaction',
  'create_queue_autoaction',
  'get_queue_autoaction_logs',
  'delete_queue',
  'restore_queue',
  'set_queue_access',
  'get_queue_user_access',
  'get_queue_group_access',
  'create_workflow',
  'get_workflows',
  'get_queue_workflows',
  'get_workflow',
  'update_workflow',
  'update_workflow_action',
  'delete_workflow',
  'get_boards',
  'get_boards_paginate',
  'get_board',
  'create_board',
  'update_board',
  'delete_board',
  'get_board_columns',
  'get_board_column',
  'create_board_column',
  'update_board_column',
  'delete_board_column',
  'get_board_sprints',
  'get_sprint',
  'create_sprint',
  'update_sprint',
  'start_sprint',
  'archive_sprint',
  'delete_sprint',
  'create_dashboard',
  'create_cycle_time_widget',
  'get_projects',
  'get_project',
  'create_project',
  'update_project',
  'delete_project',
  'get_project_queues',
  'search_entities',
  'get_entity',
  'create_entity',
  'update_entity',
  'delete_entity',
  'add_entity_comment',
  'get_entity_comments',
  'get_entity_comment',
  'update_entity_comment',
  'delete_entity_comment',
  'add_entity_checklist_items',
  'update_entity_checklist',
  'update_entity_checklist_item',
  'move_entity_checklist_item',
  'delete_entity_checklist',
  'delete_entity_checklist_item',
  'list_entity_attachments',
  'get_entity_attachment',
  'add_entity_attachment',
  'delete_entity_attachment',
  'create_entity_link',
  'get_entity_links',
  'delete_entity_link',
  'get_entity_events',
  'bulk_update_entities',
  'get_entity_access',
  'update_entity_access',
  'get_entity_permissions',
  'update_entity_permissions',
  'get_current_user',
  'get_user',
  'get_users',
  'get_users_relative',
  'get_issue_types',
 'get_link_types',
  'create_issue_type',
  'update_issue_type',
  'get_statuses',
  'create_status',
  'update_status',
  'get_resolutions',
  'create_resolution',
  'update_resolution',
  'get_priorities',
  'create_priority',
  'update_priority',
  'create_gaps',
  'find_gaps',
  'delete_gaps',
  'import_issue',
  'import_issue_comment',
  'import_issue_link',
  'import_worklog_record',
  'import_issue_attachment',
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
