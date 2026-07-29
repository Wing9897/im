import { useContext } from "react";
import type { Context } from "react";

/**
 * Safely consumes a React context that may be null.
 * Throws a descriptive error when the hook is called outside its provider,
 * making misconfiguration immediately visible during development.
 *
 * A missing provider always throws — there is no silent fallback.
 */
export function useContextWithFallback<T>(
  context: Context<T | null>,
  hookName: string,
  providerName: string,
): T {
  const value = useContext(context);
  if (value !== null && value !== undefined) {
    return value;
  }

  throw new Error(
    `${hookName} must be used within a <${providerName}>. ` +
      `Wrap your component tree with <${providerName}> to resolve this error.`,
  );
}
