const TOKEN_KEY = 'tell-token';

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Extra query string for WebSocket URLs so upgrades pass the same auth as /api/*. */
export function wsAuthQuery(): string {
  const token = getStoredToken();
  return token ? `&token=${encodeURIComponent(token)}` : '';
}

async function requestToken(): Promise<string> {
  const entered = window.prompt('Tell Web: enter the access token (TELL_TOKEN)');
  const token = (entered || '').trim();
  setStoredToken(token);
  return token;
}

/**
 * fetch() wrapper that attaches `Authorization: Bearer` when a token is known.
 * On 401, asks for the token once and retries the request.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const buildInit = (token: string): RequestInit => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
  };

  let token = getStoredToken();
  const res = await fetch(input, buildInit(token));
  if (res.status !== 401) return res;

  token = await requestToken();
  if (!token) return res;
  return fetch(input, buildInit(token));
}
