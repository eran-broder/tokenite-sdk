import type {
  TokeniteConfig,
  AuthorizeOptions,
  PopupOptions,
  PopupResult,
  TokenResponse,
  Provider,
  ProxyCallOptions,
  ProxyResponse,
  AllowedProvidersResponse,
  ProviderInfo,
} from './types.js';
import { extractErrorMessage } from './error.js';

const DEFAULT_BASE_URL = 'https://tokenite.ai';
const DEFAULT_PROXY_URL = 'https://api.tokenite.ai';
const IFRAME_WIDTH = 480;
const IFRAME_HEIGHT = 620;

/**
 * Tokenite client.
 *
 * Two ways to obtain an access token:
 *
 * **Modal (single-page apps)** — open an iframe consent screen and
 * receive an OAuth authorization code. The code must be exchanged
 * server-side because the exchange requires `clientSecret`:
 * ```typescript
 * const { code } = await tk.popup({ suggestedBudget: 5 });
 * await fetch('/api/auth/exchange', {
 *   method: 'POST',
 *   body: JSON.stringify({ code }),
 * });
 * ```
 *
 * **Redirect (server-side)** — classic OAuth bounce:
 * ```typescript
 * res.redirect(tk.getAuthorizeUrl());
 * // ...later in /callback:
 * const { access_token } = await tk.exchangeCode(req.query.code);
 * ```
 *
 * Once you have the access token, call the LLM through the proxy:
 * ```typescript
 * const result = await tk.call({
 *   accessToken,
 *   provider: 'anthropic',
 *   path: '/v1/messages',
 *   body: { model: 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [...] },
 * });
 * if (isProxyError(result)) console.error(result.error);
 * else console.log(result.data);
 * ```
 *
 * For streaming responses, use a vendor SDK with `baseURL: tk.proxyUrl(...)`
 * — streams bypass the unified envelope and are forwarded as-is.
 */
export const Tokenite = (config: TokeniteConfig) => {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const proxyBase = config.proxyUrl ?? DEFAULT_PROXY_URL;

  const buildAuthorizeUrl = (options?: AuthorizeOptions & { mode?: 'redirect' | 'popup' | 'iframe' }): string => {
    const state = options?.state ?? generateState();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    if (options?.suggestedBudget) params.set('suggested_budget', String(options.suggestedBudget));
    if (options?.mode) params.set('mode', options.mode);
    return `${baseUrl}/oauth/authorize?${params}`;
  };

  return {
    /**
     * Build the authorization URL for a full-page redirect.
     * Supports optional suggested budget that pre-fills the consent screen.
     */
    getAuthorizeUrl: (options?: AuthorizeOptions): string =>
      buildAuthorizeUrl(options),

    /**
     * Open the consent screen and resolve with an OAuth authorization
     * code when the user approves. The code must then be exchanged
     * server-side via `tk.exchangeCode(code)` (the exchange requires
     * `clientSecret`, which must never run in browser code).
     *
     * Two presentation modes:
     *
     * - `mode: 'iframe'` (default) — overlay an iframe modal in the
     *   current window. Cleaner UX, but the consent screen's host must
     *   allow being framed (no `X-Frame-Options: DENY`).
     * - `mode: 'window'` — open a separate browser popup window via
     *   `window.open`. Works regardless of frame policy.
     *
     * ```typescript
     * const { code } = await tk.popup({ suggestedBudget: 5 });
     * await fetch('/api/auth/exchange', {
     *   method: 'POST',
     *   body: JSON.stringify({ code }),
     * });
     * ```
     */
    popup: (options?: PopupOptions): Promise<PopupResult> => {
      const mode = options?.mode ?? 'iframe';
      const width = options?.width ?? IFRAME_WIDTH;
      const height = options?.height ?? IFRAME_HEIGHT;

      // The SDK's `window` mode maps to the dashboard's `popup` URL
      // param (separate browser window with `window.opener`); the
      // SDK's `iframe` mode maps to the dashboard's `iframe` URL param
      // (postMessage to `window.parent`).
      const url = buildAuthorizeUrl({
        suggestedBudget: options?.suggestedBudget,
        mode: mode === 'window' ? 'popup' : 'iframe',
      });

      return mode === 'window'
        ? openWindowPopup(url, width, height, baseUrl, config.redirectUri)
        : openIframeModal(url, width, height, baseUrl);
    },

    /**
     * Exchange an authorization code for an access token.
     * Call this server-side in your callback handler.
     * Requires clientSecret to be set in config.
     */
    exchangeCode: async (code: string): Promise<TokenResponse> => {
      if (!config.clientSecret) throw new Error('clientSecret is required for exchangeCode (server-side only)');

      const response = await fetch(`${baseUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(extractErrorMessage(body, `Token exchange failed (${response.status})`));
      }

      return response.json() as Promise<TokenResponse>;
    },

    /**
     * Make an authenticated, non-streaming request through the proxy.
     * Returns a unified envelope: `ProxySuccess` on success, `ProxyError`
     * on failure. Narrow the result with `isProxyError` / `isProxySuccess`.
     *
     * For streaming responses, use a vendor SDK with `baseURL: tk.proxyUrl(...)`
     * — streams bypass the envelope and are forwarded as-is.
     *
     * ```typescript
     * const result = await tk.call({
     *   accessToken,
     *   provider: 'anthropic',
     *   path: '/v1/messages',
     *   body: { model: 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [...] },
     * });
     * ```
     */
    call: async (options: ProxyCallOptions): Promise<ProxyResponse> => {
      const path = options.path.startsWith('/') ? options.path : `/${options.path}`;
      const response = await fetch(`${proxyBase}/${options.provider}${path}`, {
        method: options.method ?? 'POST',
        headers: {
          'authorization': `Bearer ${options.accessToken}`,
          'content-type': 'application/json',
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      return (await response.json()) as ProxyResponse;
    },

    /**
     * Fetch the access context for an access token: which app it belongs
     * to and which providers the user has authorised it to call.
     *
     * The returned `providers` list is exactly the set that will succeed
     * through `tk.call()` (budget permitting). Use it to render a picker,
     * gate UI, or detect that the user is missing a required provider.
     *
     * ```typescript
     * const { app, providers } = await tk.getAllowedProviders(accessToken);
     * for (const p of providers) {
     *   console.log(p.displayName, p.logoUrl);
     * }
     * ```
     */
    getAllowedProviders: async (accessToken: string): Promise<AllowedProvidersResponse> => {
      const response = await fetch(`${proxyBase}/me/providers`, {
        headers: { 'authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(extractErrorMessage(body, `Failed to fetch allowed providers (${response.status})`));
      }

      const data = (await response.json()) as AllowedProvidersResponse;
      return {
        ...data,
        providers: data.providers.map((p): ProviderInfo => ({
          ...p,
          logoUrl: absoluteUrl(p.logoUrl, baseUrl),
        })),
      };
    },

    /**
     * Get the proxy URL for a specific provider.
     * Use as `baseURL` in a vendor SDK for streaming requests, which
     * bypass the unified envelope.
     */
    proxyUrl: (provider: Provider): string => `${proxyBase}/${provider}`,

    /** The Tokenite dashboard base URL */
    baseUrl,

    /** The Tokenite proxy base URL */
    proxyBase,
  };
};

const generateState = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const absoluteUrl = (maybeRelative: string, base: string): string =>
  /^https?:\/\//i.test(maybeRelative) ? maybeRelative : `${base}${maybeRelative}`;

// ─── Popup hosts ───
//
// Two transports for the consent screen, sharing the same postMessage
// protocol with the dashboard:
//   { type: 'tokenite:auth-success', code }
//   { type: 'tokenite:auth-error',   error }

const openIframeModal = (
  url: string,
  width: number,
  height: number,
  baseUrl: string,
): Promise<PopupResult> => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: white; border-radius: 12px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    width: ${width}px; max-width: calc(100vw - 32px);
    height: ${height}px; max-height: calc(100vh - 32px);
  `;

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = `width: 100%; height: 100%; border: none;`;
  iframe.setAttribute('allow', 'clipboard-write');

  container.appendChild(iframe);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  return new Promise<PopupResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== baseUrl) return;

      const data = event.data as { type?: string; code?: string; error?: string };

      if (data.type === 'tokenite:auth-success' && data.code) {
        cleanup();
        resolve({ code: data.code });
      }

      if (data.type === 'tokenite:auth-error') {
        cleanup();
        reject(new Error(data.error ?? 'Authorization denied'));
      }
    };

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      overlay.remove();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        reject(new Error('Authorization cancelled'));
      }
    });

    window.addEventListener('message', onMessage);
  });
};

const openWindowPopup = (
  url: string,
  width: number,
  height: number,
  baseUrl: string,
  redirectUri: string,
): Promise<PopupResult> => {
  const left = Math.round(window.screenX + (window.innerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.innerHeight - height) / 2);

  const popup = window.open(
    url,
    'tokenite-auth',
    `width=${width},height=${height},left=${left},top=${top},popup=yes`,
  );
  if (!popup) return Promise.reject(new Error('Popup blocked'));

  return new Promise<PopupResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== baseUrl) return;

      const data = event.data as { type?: string; code?: string; error?: string };

      if (data.type === 'tokenite:auth-success' && data.code) {
        cleanup();
        resolve({ code: data.code });
      }

      if (data.type === 'tokenite:auth-error') {
        cleanup();
        reject(new Error(data.error ?? 'Authorization denied'));
      }
    };

    // Cross-origin popups can't postMessage until they navigate back to
    // our origin (the redirect URI). As a fallback, poll for that
    // navigation by trying to read the popup's URL — same-origin reads
    // succeed, cross-origin throws and we keep polling.
    const poll = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Popup closed'));
        return;
      }
      try {
        const popupUrl = popup.location.href;
        if (popupUrl.startsWith(redirectUri)) {
          const code = new URL(popupUrl).searchParams.get('code');
          if (code) {
            cleanup();
            resolve({ code });
          }
        }
      } catch {
        // cross-origin — keep polling
      }
    }, 300);

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(poll);
      if (!popup.closed) popup.close();
    };

    window.addEventListener('message', onMessage);
  });
};
