import type { AdminClient } from './client.js';
import type { ApiKeyRecord, AddApiKeyInput } from './types.js';

export const createKeysApi = (client: AdminClient) => ({
  add: (input: AddApiKeyInput): Promise<ApiKeyRecord> =>
    client.request('POST', '/api/keys', input),

  list: (): Promise<ApiKeyRecord[]> =>
    client.request('GET', '/api/keys'),

  remove: (id: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/keys/${id}`),
});
