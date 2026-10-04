import type { CallToolResult } from '@modelcontextprotocol/server';

export function jsonResult(data: unknown): CallToolResult {
  // 204 No Content и пустые ответы дают undefined — сериализуем как null.
  const text = data === undefined ? 'null' : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
  };
}

/** Картинка как image-контент (клиенты показывают её визуально). */
export function imageResult(data: Buffer, mimeType: string): CallToolResult {
  return {
    content: [
      {
        type: 'image',
        data: data.toString('base64'),
        mimeType,
      },
    ],
  };
}

/** Текст без JSON-обёртки (содержимое файлов и т.п.). */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
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
