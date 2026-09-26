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

export type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  formData?: FormData;
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

  private authHeaders(): Record<string, string> {
    const { authMethod, apiToken, orgId } = this.config;
    return {
      Authorization:
        authMethod === 'iam' ? `Bearer ${apiToken}` : `OAuth ${apiToken}`,
      [this.orgHeader]: orgId,
    };
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(this.config.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { ...this.authHeaders() };
    if (this.config.lang) {
      headers['Accept-Language'] = this.config.lang;
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
  ): Promise<T> {
    return this.request<T>('POST', path, { body, query, formData });
  }

  patch<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>('PATCH', path, { body, query });
  }

  delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>('DELETE', path, { query });
  }
}
