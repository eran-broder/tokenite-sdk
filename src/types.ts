export type TokeniteConfig = {
  /** Your app's client ID (from the Tokenite dashboard) */
  readonly clientId: string;
  /** Your app's client secret — only needed for server-side code exchange */
  readonly clientSecret?: string;
  /** The URL Tokenite redirects back to after authorization */
  readonly redirectUri: string;
  /** Tokenite base URL. Default: https://tokenite.ai */
  readonly baseUrl?: string;
  /** Tokenite proxy URL. Default: https://api.tokenite.ai */
  readonly proxyUrl?: string;
};

export type AuthorizeOptions = {
  /** Custom state parameter for CSRF protection. Auto-generated if not provided. */
  readonly state?: string;
  /** Suggested budget amount (user can override on consent screen) */
  readonly suggestedBudget?: number;
};

export type PopupOptions = {
  /** Suggested budget amount (user can override on consent screen) */
  readonly suggestedBudget?: number;
  /**
   * How to host the consent screen.
   *
   * - `'iframe'` (default) — overlay an iframe modal in the current
   *   window. Requires the dashboard to allow being framed by your
   *   origin (`Content-Security-Policy: frame-ancestors`). Cleaner UX
   *   but blocked by `X-Frame-Options: DENY`.
   * - `'window'` — open a separate browser popup window via
   *   `window.open`. Works regardless of frame policy, but the user
   *   may be prompted by their popup blocker.
   */
  readonly mode?: 'iframe' | 'window';
  /** Modal/popup width in pixels. Default: 480 */
  readonly width?: number;
  /** Modal/popup height in pixels. Default: 620 */
  readonly height?: number;
};

export type PopupResult = {
  /**
   * OAuth authorization code returned by the consent screen.
   * Send this to your backend, which exchanges it for an access token
   * via `tk.exchangeCode(code)`. The exchange requires `clientSecret`
   * and must never run in browser code.
   */
  readonly code: string;
};

export type TokenResponse = {
  readonly access_token: string;
  readonly token_type: string;
};

export type Provider = 'anthropic' | 'openai' | 'google' | 'grok' | 'bedrock';

export type ProxyCallOptions = {
  /** The user's Tokenite access token (returned by `tk.exchangeCode()`) */
  readonly accessToken: string;
  /** Which LLM provider to call */
  readonly provider: Provider;
  /** Path on the provider's API (e.g. `/v1/messages`, `/v1/chat/completions`) */
  readonly path: string;
  /** HTTP method. Default: `POST` */
  readonly method?: string;
  /** Request body — the vendor's request shape, JSON-serialised by the SDK */
  readonly body: unknown;
};

// ─── Unified proxy response types ───
//
// Every non-streaming response from the Tokenite proxy returns one of
// these shapes. SDK consumers can always check for `.error` to distinguish
// success from failure — no vendor-specific parsing required.

/** Normalised token counts (identical across all providers) */
export type ProxyUsage = {
  /** Number of tokens in the prompt / input */
  readonly inputTokens: number;
  /** Number of tokens in the completion / output */
  readonly outputTokens: number;
};

/**
 * Successful proxy response.
 *
 * `data` contains the original vendor response body (e.g. Anthropic's
 * message object, OpenAI's chat completion, etc.). `provider`, `model`,
 * and `usage` are extracted and normalised by the proxy so you don't
 * need to parse vendor-specific fields.
 */
export type ProxySuccess = {
  /** Which LLM provider handled the request */
  readonly provider: Provider;
  /** The model that generated the response */
  readonly model: string;
  /** Normalised token usage, or null if the provider didn't report it */
  readonly usage: ProxyUsage | null;
  /** The original, unmodified response body from the LLM provider */
  readonly data: unknown;
};

/**
 * Where the error originated.
 *
 * - `"proxy"` — Tokenite rejected the request (auth, budget, config).
 * - `"provider"` — The upstream LLM returned an error (rate limit, overload, etc.).
 */
export type ErrorSource = 'proxy' | 'provider';

/**
 * Error response (both proxy-level and provider-level errors share this shape).
 *
 * **Proxy error codes** (`source: "proxy"`):
 * | Code | HTTP | Description |
 * |---|---|---|
 * | `TOKEN_INVALID` | 401 | Missing or invalid bearer token |
 * | `TOKEN_REVOKED` | 401 | Access token was revoked by the user |
 * | `TOKEN_SUSPENDED` | 403 | Access suspended by the user |
 * | `TOKEN_EXPIRED` | 401 | Access token past its expiration date |
 * | `BUDGET_EXCEEDED` | 402 | Spending reached the user-defined budget limit |
 * | `PROVIDER_KEY_MISSING` | 402 | No API key or credits available for the provider |
 * | `CREDITS_DEPLETED` | 402 | Insufficient platform credits |
 * | `APP_NOT_FOUND` | 404 | Application not found |
 * | `MODEL_NOT_ALLOWED` | 403 | Model not in the app's allowed models list |
 *
 * **Provider error codes** (`source: "provider"`):
 * | Code | HTTP | Description |
 * |---|---|---|
 * | `RATE_LIMITED` | 429 | Upstream rate limit hit — retry after backoff |
 * | `CONTEXT_LENGTH_EXCEEDED` | 400 | Request exceeds model's context window |
 * | `INVALID_REQUEST` | 400 | Provider rejected the request as malformed |
 * | `AUTHENTICATION_FAILED` | 401 | Provider rejected the API key |
 * | `PROVIDER_OVERLOADED` | 503 | Provider temporarily overloaded |
 * | `CONTENT_FILTERED` | 400 | Content blocked by safety filter |
 * | `PROVIDER_TIMEOUT` | 504 | Provider did not respond in time |
 * | `PROVIDER_ERROR` | 502 | Catch-all for other provider errors |
 */
export type ProxyError = {
  readonly error: {
    /** Machine-readable error code */
    readonly code: string;
    /** Human-readable description */
    readonly message: string;
    /** Where the error originated */
    readonly source: ErrorSource;
    /** Optional structured context (e.g. `retryAfter`, `provider`, `providerMessage`) */
    readonly details?: Record<string, unknown>;
  };
};

/** Discriminated union for all non-streaming proxy responses */
export type ProxyResponse = ProxySuccess | ProxyError;

/** Type guard: returns true if the response is an error */
export const isProxyError = (response: ProxyResponse): response is ProxyError =>
  'error' in response;

/** Type guard: returns true if the response is a success */
export const isProxySuccess = (response: ProxyResponse): response is ProxySuccess =>
  'provider' in response;

// ─── Access context (tk.getAllowedProviders) ───

/** Visual + identity metadata for a single provider */
export type ProviderInfo = {
  /** Stable provider id (same value as the `Provider` union) */
  readonly id: Provider;
  /** Human-readable name, e.g. "Anthropic" */
  readonly displayName: string;
  /** Brand colour (hex string, e.g. "#d97706") */
  readonly color: string;
  /** Absolute URL to the provider's logo (PNG or SVG) */
  readonly logoUrl: string;
  /** Whether the logo is a glyph/symbol or a full wordmark */
  readonly logoStyle: 'symbol' | 'wordmark';
};

/** Summary of the app the access token belongs to */
export type AppInfo = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly websiteUrl: string | null;
  /** Absolute URL to the app's icon (PNG/SVG). null when the developer hasn't set one — render initials or a generic glyph. */
  readonly iconUrl: string | null;
  /** Providers the app declares it needs */
  readonly requiredProviders: readonly Provider[];
  /** Fallback order when `allowSubstitution` is true */
  readonly preferredProviders: readonly Provider[];
  /** Whether the app accepts substitute providers when a required one isn't available */
  readonly allowSubstitution: boolean;
};

/**
 * Full access context for a single access token.
 *
 * `providers` lists only the providers the user has an active key for —
 * exactly the set that will succeed through `tk.call()` (budget permitting).
 */
export type AllowedProvidersResponse = {
  readonly app: AppInfo;
  readonly providers: readonly ProviderInfo[];
};
