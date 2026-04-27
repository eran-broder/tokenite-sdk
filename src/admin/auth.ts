import type { AdminClient } from './client.js';
import type {
  RegisterUserInput, RegisterUserResult,
  LoginInput, LoginResult, Me,
  CreateTokenInput, CreatedPat, PatRecord,
} from './types.js';

export const createAuthApi = (client: AdminClient) => ({
  register: (input: RegisterUserInput): Promise<RegisterUserResult> =>
    client.request('POST', '/api/auth/register', input),

  login: (input: LoginInput): Promise<LoginResult> =>
    client.request('POST', '/api/auth/login', input),

  me: (): Promise<Me> =>
    client.request('GET', '/api/auth/me'),

  createToken: (input: CreateTokenInput): Promise<CreatedPat> =>
    client.request('POST', '/api/auth/tokens', input),

  listTokens: (): Promise<PatRecord[]> =>
    client.request('GET', '/api/auth/tokens'),

  revokeToken: (tokenId: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/auth/tokens/${tokenId}`),
});
