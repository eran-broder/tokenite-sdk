import type { AdminClient } from './client.js';
import type { AppRecord, CreatedApp, CreateAppInput, UpdateAppInput } from './types.js';

export const createAppsApi = (client: AdminClient) => ({
  create: (input: CreateAppInput): Promise<CreatedApp> =>
    client.request('POST', '/api/apps', input),

  list: (): Promise<AppRecord[]> =>
    client.request('GET', '/api/apps'),

  get: (id: string): Promise<AppRecord> =>
    client.request('GET', `/api/apps/${id}`),

  update: (id: string, input: UpdateAppInput): Promise<AppRecord> =>
    client.request('PATCH', `/api/apps/${id}`, input),

  rotateSecret: (id: string): Promise<{ appSecret: string }> =>
    client.request('POST', `/api/apps/${id}/rotate-secret`),

  delete: (id: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/apps/${id}`),
});
