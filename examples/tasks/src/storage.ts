/** Reads a value that an earlier visit saved, or `fallback`. */
export function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(`solid-sfc-${key}`);
    return saved === null ? fallback : (JSON.parse(saved) as T);
  } catch {
    // Storage can be unavailable, for example in private windows.
    return fallback;
  }
}

/** Saves a value for the next visit. */
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`solid-sfc-${key}`, JSON.stringify(value));
  } catch {
    // The value is only kept for this visit.
  }
}
