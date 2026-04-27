import type { AdminClient } from './client.js';
import type { SpendingFilters, SpendingEntry } from './types.js';

const buildQuery = (filters: SpendingFilters): string => {
  const params = new URLSearchParams();
  if (filters.appId) params.set('appId', filters.appId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const createSpendingApi = (client: AdminClient) => ({
  list: (filters: SpendingFilters = {}): Promise<SpendingEntry[]> =>
    client.request('GET', `/api/spending${buildQuery(filters)}`),
});
