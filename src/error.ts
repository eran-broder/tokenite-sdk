/**
 * Extract a human-readable error message from a Tokenite-style envelope.
 *
 * The dashboard returns `{ error: { code, message, status?, details? } }`
 * for structured errors and (rarely) `{ error: "literal message" }` from
 * legacy paths. This helper unifies both shapes and falls back to a
 * caller-supplied default when the body is missing or malformed.
 */
export const extractErrorMessage = (body: unknown, fallback: string): string => {
  const err = (body as { error?: unknown } | null | undefined)?.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
};
