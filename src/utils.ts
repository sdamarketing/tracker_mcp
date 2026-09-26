import type { CallToolResult } from '@modelcontextprotocol/server';

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return jsonResult(data);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return errorResult(message);
  }
}

/** Merge defined optional fields into an object, skipping undefined values. */
export function setIfDefined(
  target: Record<string, unknown>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}
