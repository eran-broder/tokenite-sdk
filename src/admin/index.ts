import { createAdminClient } from './client.js';
import { createAuthApi } from './auth.js';
import { createAccountsApi } from './accounts.js';
import { createAppsApi } from './apps.js';
import { createKeysApi } from './keys.js';
import { createOAuthApi } from './oauth.js';
import { createConnectionsApi } from './connections.js';
import { createSpendingApi } from './spending.js';

export type TokeniteAdminConfig = {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly accountId?: string;
};

export const TokeniteAdmin = (config: TokeniteAdminConfig) => {
  const client = createAdminClient(config);
  return {
    auth: createAuthApi(client),
    accounts: createAccountsApi(client),
    apps: createAppsApi(client),
    keys: createKeysApi(client),
    oauth: createOAuthApi(client),
    connections: createConnectionsApi(client),
    spending: createSpendingApi(client),
  };
};

export { AdminClientError } from './client.js';
export type { AdminClient, AdminClientConfig } from './client.js';
export type * from './types.js';
