import type { TrackerConfig } from './config.js';

export class TrackerApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TrackerApiError';
  }
}

export interface ResponseWithHeaders<T> {
  data: T;
  headers: Record<string, string>;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  formData?: FormData;
  /** Оптимистичная блокировка редактирования (412 при конфликте версий). */
  ifMatch?: string | number;
}

function formatErrorBody(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as {
      errors?: Record<string, string | string[]>;
      errorMessages?: string[];
    };
    const parts: string[] = [];
    if (parsed.errorMessages?.length) {
      parts.push(parsed.errorMessages.join('; '));
    }
    if (parsed.errors) {
      for (const [field, messages] of Object.entries(parsed.errors)) {
        const msg = Array.isArray(messages) ? messages.join(', ') : messages;
        parts.push(`${field}: ${msg}`);
      }
    }
    const detail = parts.length ? parts.join(' | ') : text.slice(0, 500);
    return `Yandex Tracker API error ${status}: ${detail}`;
  } catch {
    return `Yandex Tracker API error ${status}: ${text.slice(0, 500)}`;
  }
}

export class TrackerClient {
  constructor(private readonly config: TrackerConfig) {}

  get orgHeader(): string {
    // Yandex 360 organizations use X-Org-ID, Yandex Cloud (Identity Hub) use X-Cloud-Org-ID.
    return this.config.authMethod === 'iam' ? 'X-Cloud-Org-ID' : 'X-Org-ID';
  }

  /**
   * Пути с явной версией ("/v2/filters/…") заменяют версию из baseUrl —
   * некоторые эндпоинты документированы только в v2 (например, delete filter).
   */
  private resolvePath(path: string): string {
    const match = /^\/(v\d+)\//.exec(path);
    if (match && this.config.baseUrl.endsWith('/v3')) {
      return this.config.baseUrl.slice(0, -3) + path;
    }
    return this.config.baseUrl + path;
  }

  private authHeaders(): Record<string, string> {
    const { authMethod, apiToken, orgId } = this.config;
    return {
      Authorization:
        authMethod === 'iam' ? `Bearer ${apiToken}` : `OAuth ${apiToken}`,
      [this.orgHeader]: orgId,
    };
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(this.resolvePath(path));
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { ...this.authHeaders() };
    if (this.config.lang) {
      headers['Accept-Language'] = this.config.lang;
    }
    if (options.ifMatch !== undefined) {
      headers['If-Match'] = String(options.ifMatch);
    }

    let body: BodyInit | undefined;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new TrackerApiError(0, `Failed to reach Yandex Tracker API (${url}): ${reason}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new TrackerApiError(response.status, formatErrorBody(response.status, text));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  post<T>(
    path: string,
    body?: unknown,
    query?: QueryParams,
    formData?: FormData,
    ifMatch?: string | number,
  ): Promise<T> {
    return this.request<T>('POST', path, { body, query, formData, ifMatch });
  }

  /** POST с заголовками ответа (нужно для scroll-поиска: X-Scroll-Id и т.п.). */
  async postWithHeaders<T>(
    path: string,
    body?: unknown,
    query?: QueryParams,
  ): Promise<ResponseWithHeaders<T>> {
    const url = new URL(this.resolvePath(path));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    const headers: Record<string, string> = {
      ...this.authHeaders(),
      'Content-Type': 'application/json',
    };
    if (this.config.lang) {
      headers['Accept-Language'] = this.config.lang;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new TrackerApiError(
        response.status,
        formatErrorBody(response.status, text),
      );
    }
    const outHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      outHeaders[key] = value;
    });
    const text = await response.text();
    return {
      data: text ? (JSON.parse(text) as T) : (undefined as T),
      headers: outHeaders,
    };
  }

  /** GET бинарного ресурса (вложения, миниатюры). */
  async download(
    path: string,
    query?: QueryParams,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const url = new URL(this.resolvePath(path));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new TrackerApiError(
        response.status,
        formatErrorBody(response.status, text),
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  patch<T>(
    path: string,
    body?: unknown,
    query?: QueryParams,
    ifMatch?: string | number,
  ): Promise<T> {
    return this.request<T>('PATCH', path, { body, query, ifMatch });
  }

  delete<T>(
    path: string,
    query?: QueryParams,
    ifMatch?: string | number,
  ): Promise<T> {
    return this.request<T>('DELETE', path, { query, ifMatch });
  }
}
