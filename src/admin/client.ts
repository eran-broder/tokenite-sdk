export type AdminClientConfig = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly accountId?: string;
};

export type AdminClient = {
  readonly request: <T>(method: string, path: string, body?: unknown, overrides?: RequestOverrides) => Promise<T>;
};

export type RequestOverrides = {
  readonly accountId?: string;
};

const DEFAULT_BASE_URL = 'https://api.tokenite.ai';

export const createAdminClient = (config: { baseUrl?: string; apiKey: string; accountId?: string }): AdminClient => {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey;
  const defaultAccountId = config.accountId;

  const request = async <T>(method: string, path: string, body?: unknown, overrides?: RequestOverrides): Promise<T> => {
    const accountId = overrides?.accountId ?? defaultAccountId;
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (accountId) headers['x-account-id'] = accountId;

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const parsed: unknown = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const message = errorMessage(parsed) ?? `${method} ${path} failed (${response.status})`;
      throw new AdminClientError(message, response.status, parsed);
    }

    return parsed as T;
  };

  return { request };
};

export class AdminClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'AdminClientError';
    this.status = status;
    this.body = body;
  }
}

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const errorMessage = (parsed: unknown): string | undefined => {
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const error = (parsed as Record<string, unknown>)['error'];
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>)['message'];
    if (typeof message === 'string') return message;
  }
  return undefined;
};
