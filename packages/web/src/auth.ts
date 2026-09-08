/**
 * Volatile in-memory token store.
 * The TELL_TOKEN is NEVER persisted: no localStorage, no sessionStorage,
 * no cookies, no URL/history. Reload / tab close wipes it (by design —
 * the user types the token on every connection).
 */

let memoryToken = '';

export function setMemoryToken(token: string): void {
  memoryToken = token;
}

export function getMemoryToken(): string {
  return memoryToken;
}

export function clearMemoryToken(): void {
  memoryToken = '';
}

/** Extra query string for WebSocket URLs (token comes from memory only). */
export function wsAuthQuery(token?: string): string {
  const t = token ?? memoryToken;
  return t ? `&token=${encodeURIComponent(t)}` : '';
}
