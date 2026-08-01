/** Ensures a value is an array, returning [] if null/undefined */
export function safeArray<T>(value: T[] | null | undefined): T[] {
  return value ?? [];
}
