# @tokenite/sdk

One wallet for all your AI apps. Users store their Anthropic, OpenAI, and Google API keys in Tokenite, then grant your app metered access via OAuth. You pay nothing for AI usage.

## Install

```bash
npm install @tokenite/sdk
```

## Quick Start

```typescript
import { Tokenite, isProxyError } from '@tokenite/sdk';

const tw = Tokenite({
  clientId: 'your-app-id',
  clientSecret: 'your-app-secret',
  redirectUri: 'https://yourapp.com/callback',
});

// 1. Redirect the user to the consent screen
app.get('/login', (req, res) => res.redirect(tk.getAuthorizeUrl()));

// 2. Exchange the OAuth code for an access token in your callback
app.get('/callback', async (req, res) => {
  const { access_token } = await tk.exchangeCode(req.query.code as string);
  req.session.tokeniteToken = access_token;
  res.redirect('/');
});

// 3. Call the LLM through the proxy
app.post('/chat', async (req, res) => {
  const result = await tk.call({
    accessToken: req.session.tokeniteToken,
    provider: 'anthropic',
    path: '/v1/messages',
    body: {
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [{ role: 'user', content: req.body.prompt }],
    },
  });

  if (isProxyError(result)) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ model: result.model, usage: result.usage, data: result.data });
});
```

The same `tk.call(...)` works for OpenAI and Google — change `provider` and `path`:

```typescript
await tk.call({
  accessToken,
  provider: 'openai',
  path: '/v1/chat/completions',
  body: { model: 'gpt-4o', messages: [...] },
});

await tk.call({
  accessToken,
  provider: 'google',
  path: '/v1beta/models/gemini-1.5-pro:generateContent',
  body: { contents: [...] },
});
```

### Modal flow (single-page apps)

If your app is a SPA, open the consent screen in an iframe modal:

```typescript
const { code } = await tk.popup({ suggestedBudget: 5 });

// Send the code to your backend, which calls tk.exchangeCode(code).
// The exchange requires clientSecret and must never run in browser code.
await fetch('/api/auth/exchange', {
  method: 'POST',
  body: JSON.stringify({ code }),
});
```

### Managed agents (Anthropic)

Tokenite proxies Anthropic's [Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview) surface — the `/v1/agents`, `/v1/environments`, `/v1/sessions`, `/v1/vaults`, and `/v1/files` endpoints — under the same BYOK model as Messages. The app points the Anthropic SDK at `tk.proxyUrl('anthropic')`; the proxy injects the managed-agents beta header and forwards calls to the user's Anthropic org.

**Explicit consent required.** Because agent sessions run long-lived, billable server-side work on Anthropic (`$0.08/hr` session runtime on top of tokens), the proxy rejects agent-surface calls unless the app was created with `allowsManagedAgents: true`. The flag sits alongside the other app fields on creation:

```typescript
await admin.apps.create({
  name: 'Life Coach',
  callbackUrl: 'https://lifecoach.ai/callback',
  requiredProviders: ['anthropic'],
  allowsManagedAgents: true,          // ← opt in
});
```

Without it, every agent endpoint returns `403 AGENT_SCOPE_MISSING`.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: accessToken,
  baseURL: tk.proxyUrl('anthropic'),
});

// Provision once per user.
const agent = await anthropic.beta.agents.create({
  name: 'Life Coach',
  model: 'claude-haiku-4-5',
  system: 'You are a terse life coach.',
  tools: [{ type: 'agent_toolset_20260401' }],
});

// Spin up a session.
const env = await anthropic.beta.environments.create({ name: 'prod' });
const session = await anthropic.beta.sessions.create({
  agent: agent.id,
  environment_id: env.id,
});

// Send events, stream responses — all proxied.
await anthropic.beta.sessions.events.post(session.id, {
  type: 'user.message', content: 'What should I focus on today?',
});

for await (const event of anthropic.beta.sessions.events.stream(session.id)) {
  // ...
}

// Archive when done. This is what triggers Tokenite to pull the final
// usage totals from Anthropic and debit tokens + runtime against the budget.
await anthropic.beta.sessions.archive(session.id);
```

Tokenite tracks each session for attribution and auto-terminates running sessions when the user revokes the connection — otherwise Anthropic would keep billing `$0.08/hr` for the session runtime on top of tokens. The proxy bills the user's wallet at archive time using Anthropic's reported cumulative usage and runtime, plus the standard token rate from the model's pricing.

Budget is checked pre-call but not enforced mid-session: a session that started under budget can run past it. Revoke is the user's hard kill switch.

### Streaming responses

`tk.call()` is for non-streaming requests. Streaming responses bypass the unified envelope and are forwarded as-is, so use any vendor SDK with `baseURL: tk.proxyUrl(...)`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: accessToken,
  baseURL: tk.proxyUrl('anthropic'),
});

const stream = await anthropic.messages.stream({
  model: 'claude-3-5-sonnet-latest',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story.' }],
});

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## API

<!-- GEN:API -->
### `.getAuthorizeUrl(options?: AuthorizeOptions) => string`

Build the authorization URL for a full-page redirect. Supports optional suggested budget that pre-fills the consent screen.

### `.popup(options?: PopupOptions) => Promise<PopupResult>`

Open the consent screen and resolve with an OAuth authorization code when the user approves. The code must then be exchanged server-side via `tk.exchangeCode(code)` (the exchange requires `clientSecret`, which must never run in browser code).

### `.exchangeCode(code: string) => Promise<TokenResponse>`

Exchange an authorization code for an access token. Call this server-side in your callback handler. Requires clientSecret to be set in config.

### `.call(options: ProxyCallOptions) => Promise<ProxyResponse>`

Make an authenticated, non-streaming request through the proxy. Returns a unified envelope: `ProxySuccess` on success, `ProxyError` on failure. Narrow the result with `isProxyError` / `isProxySuccess`.

### `.proxyUrl(provider: Provider) => string`

Get the proxy URL for a specific provider. Use as `baseURL` in a vendor SDK for streaming requests, which bypass the unified envelope.

### `.baseUrl`: `string`

The Tokenite dashboard base URL

### `.proxyBase`: `string`

The Tokenite proxy base URL
<!-- /GEN:API -->

## Types

<!-- GEN:TYPES -->
```typescript
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
```
<!-- /GEN:TYPES -->

## Error Codes

Non-streaming proxy responses return a unified error envelope:

```json
{ "error": { "code": "...", "message": "...", "source": "proxy" | "provider", "details": { } } }
```

`source` distinguishes errors raised by the Tokenite proxy from errors forwarded from the upstream LLM. Use the `isProxyError` type guard to narrow a `ProxyResponse` before reading `error.code`.

### Proxy errors (`source: "proxy"`)

| Code | Status | Meaning |
|------|--------|---------|
| `TOKEN_INVALID` | 401 | Missing or unrecognized access token |
| `TOKEN_REVOKED` | 401 | User revoked access |
| `TOKEN_EXPIRED` | 401 | Token expired (30-day lifetime) |
| `TOKEN_SUSPENDED` | 403 | User temporarily suspended access |
| `BUDGET_EXCEEDED` | 402 | Spending limit reached |
| `PROVIDER_KEY_MISSING` | 402 | No API key or credits available for the provider |
| `CREDITS_DEPLETED` | 402 | Insufficient platform credits |
| `MODEL_NOT_ALLOWED` | 403 | Model not in your app's allowed list |
| `AGENT_SCOPE_MISSING` | 403 | App doesn't have the managed-agents scope (set `allowsManagedAgents: true` at app creation) |
| `APP_NOT_FOUND` | 404 | Application not found |

### Provider errors (`source: "provider"`)

| Code | Status | Meaning |
|------|--------|---------|
| `RATE_LIMITED` | 429 | Upstream rate limit hit — retry after backoff |
| `CONTEXT_LENGTH_EXCEEDED` | 400 | Request exceeds the model's context window |
| `INVALID_REQUEST` | 400 | Provider rejected the request as malformed |
| `CONTENT_FILTERED` | 400 | Content blocked by the provider's safety filter |
| `AUTHENTICATION_FAILED` | 401 | Provider rejected the API key |
| `PROVIDER_OVERLOADED` | 503 | Provider temporarily overloaded |
| `PROVIDER_TIMEOUT` | 504 | Provider did not respond in time |
| `PROVIDER_ERROR` | 502 | Catch-all for other provider errors |

## License

MIT
