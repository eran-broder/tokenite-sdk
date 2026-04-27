import type { Provider } from '../types.js';

export type ModelStrategy = 'any' | 'tier' | 'models';
export type RequiredTier = 'cheap' | 'fast' | 'smart' | 'reasoning';

export type AppRecord = {
  readonly id: string;
  readonly builderId: string;
  readonly name: string;
  readonly callbackUrl: string;
  readonly requiredProviders: readonly Provider[];
  readonly preferredProviders: readonly Provider[];
  readonly allowSubstitution: boolean;
  readonly allowedModels?: readonly string[];
  readonly modelStrategy: ModelStrategy;
  readonly requiredTier?: RequiredTier;
  readonly allowsManagedAgents?: boolean;
  readonly websiteUrl?: string;
  readonly description?: string;
  readonly iconUrl?: string;
  readonly createdAt: string;
};

export type CreatedApp = AppRecord & { readonly appSecret: string };

export type CreateAppInput = {
  readonly name: string;
  readonly callbackUrl: string;
  readonly requiredProviders: readonly Provider[];
  readonly preferredProviders?: readonly Provider[];
  readonly allowSubstitution?: boolean;
  readonly allowedModels?: readonly string[];
  readonly modelStrategy?: ModelStrategy;
  readonly requiredTier?: RequiredTier;
  readonly allowsManagedAgents?: boolean;
  readonly websiteUrl?: string;
  readonly description?: string;
  readonly iconUrl?: string;
};

export type UpdateAppInput = Partial<CreateAppInput>;

export type ApiKeyRecord = {
  readonly id: string;
  readonly userId: string;
  readonly provider: Provider;
  readonly keyHint: string;
  readonly isActive: boolean;
  readonly createdAt: string;
};

export type AddApiKeyInput = {
  readonly apiKey: string;
  readonly provider?: Provider;
};

export type AuthorizeInput = {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly budgetLimit: number;
  readonly state?: string;
};

export type AuthorizeResult = {
  readonly redirect_to: string;
  readonly code: string;
};

export type ExchangeInput = {
  readonly code: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
};

export type ExchangeResult = {
  readonly access_token: string;
  readonly token_type: string;
};

export type ConnectionRecord = {
  readonly id: string;
  readonly appId: string;
  readonly appName: string;
  readonly appWebsiteUrl: string | null;
  readonly appDescription: string | null;
  readonly appIconUrl: string | null;
  readonly budgetLimit: number;
  readonly budgetSpent: number;
  readonly isSuspended: boolean;
  readonly createdAt: string;
};

export type ConnectionStats = {
  readonly totalRequests: number;
  readonly totalTokens: number;
  readonly totalCost: number;
};

export type SpendingFilters = {
  readonly appId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
};

export type SpendingEntry = {
  readonly id: string;
  readonly appName: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly platformFeeUsd: number;
  readonly createdAt: string;
};

export type RegisterUserInput = {
  readonly email: string;
  readonly password: string;
};

export type RegisterUserResult = {
  readonly userId: string;
  readonly token: string;
};

export type LoginInput = RegisterUserInput;

export type LoginResult = {
  readonly token: string;
};

export type Me = {
  readonly userId: string;
  readonly email: string;
};

export type CreateTokenInput = {
  readonly name: string;
};

export type PatRecord = {
  readonly id: string;
  readonly name: string;
  readonly keyHint: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
};

export type CreatedPat = PatRecord & { readonly token: string };

export type AccountType = 'personal' | 'business';

export type PoolResetPeriod = 'monthly' | null;

export type AccountRecord = {
  readonly id: string;
  readonly type: AccountType;
  readonly name: string;
  readonly ownerUserId: string;
  readonly poolBudgetLimitUsd: number | null;
  readonly poolBudgetSpentUsd: number;
  readonly poolResetPeriod: PoolResetPeriod;
  readonly poolLastResetAt: string | null;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  /** Present on /api/accounts list responses; absent on bare account records. */
  readonly role?: 'owner' | 'member';
};

export type CreateAccountInput = {
  readonly type: 'business';
  readonly name: string;
};

export type UpdateAccountInput = {
  readonly name?: string;
  readonly poolBudgetLimitUsd?: number | null;
  readonly poolResetPeriod?: PoolResetPeriod;
};

export type InvitationRecord = {
  readonly id: string;
  readonly accountId: string;
  readonly email: string;
  readonly role: 'owner' | 'member';
  readonly invitedByUserId: string;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly createdAt: string;
};

export type InvitationWithClaim = InvitationRecord & { readonly claimUrl: string };

export type CreateInvitationInput = {
  readonly email: string;
  readonly role?: 'owner' | 'member';
};

export type MemberRecord = {
  readonly accountId: string;
  readonly userId: string;
  readonly email: string;
  readonly role: 'owner' | 'member';
  readonly monthlyCapUsd: number | null;
  readonly joinedAt: string;
  readonly mtdSpendUsd: number;
};

export type UpdateMemberInput = {
  readonly role?: 'owner' | 'member';
  readonly monthlyCapUsd?: number | null;
};

export type ClaimInvitationInput = {
  readonly token: string;
};

export type ClaimInvitationResult = {
  readonly accountId: string;
  readonly role: 'owner' | 'member';
};
