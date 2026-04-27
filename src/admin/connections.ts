import type { AdminClient } from './client.js';
import type { ConnectionRecord, ConnectionStats } from './types.js';

export const createConnectionsApi = (client: AdminClient) => ({
  list: (): Promise<ConnectionRecord[]> =>
    client.request('GET', '/api/connections'),

  stats: (id: string): Promise<ConnectionStats> =>
    client.request('GET', `/api/connections/${id}/stats`),

  setBudget: (id: string, budgetLimit: number): Promise<{ ok: true }> =>
    client.request('PATCH', `/api/connections/${id}/budget`, { budget_limit: budgetLimit }),

  suspend: (id: string): Promise<{ ok: true }> =>
    client.request('POST', `/api/connections/${id}/suspend`),

  resume: (id: string): Promise<{ ok: true }> =>
    client.request('POST', `/api/connections/${id}/resume`),

  revoke: (id: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/connections/${id}`),
});
