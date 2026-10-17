const fallbackValues = new Map<string, string>();

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredValue(key: string): string | null {
  try {
    const storedValue = getLocalStorage()?.getItem(key);
    if (storedValue != null) return storedValue;
  } catch {
    // Use the in-memory value below when storage is blocked.
  }
  return fallbackValues.get(key) ?? null;
}

export function setStoredValue(key: string, value: string): void {
  fallbackValues.set(key, value);
  try {
    getLocalStorage()?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or restricted mobile browsers.
  }
}

export function removeStoredValue(key: string): void {
  fallbackValues.delete(key);
  try {
    getLocalStorage()?.removeItem(key);
  } catch {
    // Storage can be unavailable in private or restricted mobile browsers.
  }
}