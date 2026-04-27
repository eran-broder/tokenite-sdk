import type { AdminClient } from './client.js';
import type {
  AccountRecord, CreateAccountInput, UpdateAccountInput,
  InvitationRecord, InvitationWithClaim, CreateInvitationInput,
  MemberRecord, UpdateMemberInput,
  ClaimInvitationInput, ClaimInvitationResult,
} from './types.js';

export const createAccountsApi = (client: AdminClient) => ({
  list: (): Promise<AccountRecord[]> =>
    client.request('GET', '/api/accounts'),

  create: (input: CreateAccountInput): Promise<AccountRecord> =>
    client.request('POST', '/api/accounts', input),

  get: (id: string): Promise<AccountRecord & { role: 'owner' | 'member' }> =>
    client.request('GET', `/api/accounts/${id}`, undefined, { accountId: id }),

  update: (id: string, input: UpdateAccountInput): Promise<AccountRecord> =>
    client.request('PATCH', `/api/accounts/${id}`, input, { accountId: id }),

  delete: (id: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/accounts/${id}`, undefined, { accountId: id }),

  invite: (accountId: string, input: CreateInvitationInput): Promise<InvitationWithClaim> =>
    client.request('POST', `/api/accounts/${accountId}/invitations`, input, { accountId }),

  invitations: (accountId: string): Promise<InvitationRecord[]> =>
    client.request('GET', `/api/accounts/${accountId}/invitations`, undefined, { accountId }),

  cancelInvite: (accountId: string, invitationId: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/accounts/${accountId}/invitations/${invitationId}`, undefined, { accountId }),

  members: (accountId: string): Promise<MemberRecord[]> =>
    client.request('GET', `/api/accounts/${accountId}/members`, undefined, { accountId }),

  updateMember: (accountId: string, userId: string, input: UpdateMemberInput): Promise<MemberRecord> =>
    client.request('PATCH', `/api/accounts/${accountId}/members/${userId}`, input, { accountId }),

  removeMember: (accountId: string, userId: string): Promise<{ ok: true }> =>
    client.request('DELETE', `/api/accounts/${accountId}/members/${userId}`, undefined, { accountId }),

  leave: (accountId: string): Promise<{ ok: true }> =>
    client.request('POST', `/api/accounts/${accountId}/leave`, undefined, { accountId }),

  claim: (input: ClaimInvitationInput): Promise<ClaimInvitationResult> =>
    client.request('POST', '/api/invitations/claim', input),
});
