// Login isolation (task-login): token never persisted client-side; server
// verifies with constant-time compare + strict rate limit; WS drops tokenless upgrades.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { loadModule, WEB_SRC } from './helper.js';

const {
  isValidTokenInput,
  loginBackoffMs,
  authFailureMessage,
  AUTH_TOKEN_MAX_LENGTH,
} = loadModule('guards.ts');

describe('auth guards (pure)', () => {
  it('AUTH_TOKEN_MAX_LENGTH is 256', () => {
    assert.strictEqual(AUTH_TOKEN_MAX_LENGTH, 256);
  });

  it('accepts plausible tokens', () => {
    assert.strictEqual(isValidTokenInput('secret123'), true);
    assert.strictEqual(isValidTokenInput('a'.repeat(256)), true);
  });

  it('rejects empty/blank/non-string/oversized tokens (no oracle detail)', () => {
    assert.strictEqual(isValidTokenInput(''), false);
    assert.strictEqual(isValidTokenInput('   '), false);
    assert.strictEqual(isValidTokenInput(undefined), false);
    assert.strictEqual(isValidTokenInput(null), false);
    assert.strictEqual(isValidTokenInput(123), false);
    assert.strictEqual(isValidTokenInput('a'.repeat(257)), false);
  });

  it('rejects NUL/CR/LF (log injection / header splitting)', () => {
    assert.strictEqual(isValidTokenInput('ab\0cd'), false);
    assert.strictEqual(isValidTokenInput('ab\ncd'), false);
    assert.strictEqual(isValidTokenInput('ab\rcd'), false);
  });

  it('backoff is progressive (server limit is authoritative)', () => {
    assert.strictEqual(loginBackoffMs(0), 0);
    assert.strictEqual(loginBackoffMs(2), 0);
    assert.strictEqual(loginBackoffMs(3), 5_000);
    assert.strictEqual(loginBackoffMs(4), 5_000);
    assert.strictEqual(loginBackoffMs(5), 30_000);
    assert.strictEqual(loginBackoffMs(99), 30_000);
  });

  it('failure message is generic', () => {
    assert.strictEqual(authFailureMessage(), 'Invalid token');
  });
});

const TSX_CLI = path.join(WEB_SRC, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = 'test-token-abc123';

let dir;
let child;
let base;

async function waitForServer(proc, timeoutMs = 45000) {
  let out = '';
  const portPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start. Output: ${out.slice(-2000)}`)), timeoutMs);
    proc.stdout.on('data', (d) => {
      out += d.toString();
      const m = out.match(/running at http:\/\/\S+:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.stderr.on('data', (d) => {
      out += d.toString();
    });
    proc.on('exit', (code) => reject(new Error(`server exited ${code}. Output: ${out.slice(-2000)}`)));
  });
  const port = await portPromise;
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      const res = await fetch(`${url}/api/auth/status`);
      if (res.ok) return url;
    } catch {
      /* still booting */
    }
    if (Date.now() > deadline) throw new Error('/api/auth/status did not respond');
    await sleep(250);
  }
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tell-web-auth-'));
  fs.writeFileSync(path.join(dir, 'hello.txt'), 'hi\n');
  child = spawn(process.execPath, [TSX_CLI, 'server.ts', '--cwd', dir], {
    cwd: WEB_SRC,
    env: { ...process.env, PORT: '0', TELL_TOKEN: TOKEN },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await waitForServer(child);
});

after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const verify = (token, extra) =>
  fetch(`${base}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(token === undefined ? {} : { token }),
    ...extra,
  });

describe('auth endpoints (TELL_TOKEN set)', () => {
  it('/api/auth/status is public and leaks nothing', async () => {
    const res = await fetch(`${base}/api/auth/status`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.authRequired, true);
    assert.ok(!('cwd' in body), 'status must not leak cwd');
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  });

  it('correct token verifies (200)', async () => {
    const res = await verify(TOKEN);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
  });

  it('wrong token fails with a generic 401 (no oracle)', async () => {
    const res = await verify('wrong-token');
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'Invalid token');
  });

  it('malformed tokens fail with the SAME generic 401', async () => {
    // NOTE: only 3 calls — the 256/257 boundary is covered by the pure
    // guards tests above, and verify quota is 5/15min/IP (see 429 test).
    for (const bad of ['', '   ', undefined]) {
      const res = await verify(bad);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'Invalid token');
    }
  });

  it('/api/config now requires auth (no anon cwd/model leak)', async () => {
    const anon = await fetch(`${base}/api/config`);
    assert.strictEqual(anon.status, 401);
    const authed = await fetch(`${base}/api/config`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.strictEqual(authed.status, 200);
  });

  it('brute force is throttled: 429 + Retry-After after 5 attempts', async () => {
    // Quota (5/15min/IP) is already spent by the verifies above → next fails 429.
    const res = await verify('wrong-again');
    assert.strictEqual(res.status, 429);
    assert.ok(res.headers.get('retry-after'), '429 must carry Retry-After');
    const body = await res.json();
    assert.ok(/too many/i.test(body.error));
  });
});

describe('terminal WS auth', () => {
  it('destroys upgrades without a token (never opens)', async () => {
    const opened = await new Promise((resolve) => {
      const ws = new WebSocket(`${base.replace('http', 'ws')}/api/terminal?paneId=test-auth-1&cols=80&rows=24`);
      let done = false;
      const finish = (v) => {
        if (!done) {
          done = true;
          try {
            ws.terminate();
          } catch {
            /* ignore */
          }
          resolve(v);
        }
      };
      ws.on('open', () => finish(true));
      ws.on('error', () => finish(false));
      ws.on('close', () => finish(false));
      setTimeout(() => finish(false), 5000);
    });
    assert.strictEqual(opened, false);
  });

  it('opens with the in-memory token (login success path)', async () => {
    const opened = await new Promise((resolve) => {
      const ws = new WebSocket(
        `${base.replace('http', 'ws')}/api/terminal?paneId=test-auth-2&cols=80&rows=24&token=${encodeURIComponent(TOKEN)}`,
      );
      let done = false;
      const finish = (v) => {
        if (!done) {
          done = true;
          try {
            ws.close();
            ws.terminate();
          } catch {
            /* ignore */
          }
          resolve(v);
        }
      };
      ws.on('open', () => finish(true));
      ws.on('error', () => finish(false));
      setTimeout(() => finish(false), 5000);
    });
    assert.strictEqual(opened, true);
  });
});
