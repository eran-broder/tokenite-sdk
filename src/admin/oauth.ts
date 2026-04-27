import type { AdminClient } from './client.js';
import type { AuthorizeInput, AuthorizeResult, ExchangeInput, ExchangeResult } from './types.js';

export const createOAuthApi = (client: AdminClient) => ({
  authorize: (input: AuthorizeInput): Promise<AuthorizeResult> =>
    client.request('POST', '/api/oauth/authorize', {
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      budget_limit: input.budgetLimit,
      ...(input.state ? { state: input.state } : {}),
    }),

  exchange: (input: ExchangeInput): Promise<ExchangeResult> =>
    client.request('POST', '/api/oauth/token', {
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
    }),
});
