import { getMemoryToken } from './auth.ts';

/**
 * fetch() wrapper that attaches `Authorization: Bearer` from the volatile
 * in-memory token (see auth.ts — never persisted to storage).
 * Does NOT prompt or retry: on 401 it notifies the auth gate (which returns
 * to the isolated login screen) via a `tell:unauthorized` window event.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getMemoryToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && token) {
    window.dispatchEvent(new CustomEvent('tell:unauthorized'));
  }
  return res;
}
