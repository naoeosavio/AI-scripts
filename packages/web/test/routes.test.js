// HTTP routes against a real server on an ephemeral port (fetch, no supertest).
// Covers task_build: traversal 403, .env 403, /tell 400, /snapshot returns name.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WEB_SRC } from './helper.js';

const TSX_CLI = path.join(WEB_SRC, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let dir;
let child;
let base;

async function waitForServer(proc, timeoutMs = 45000) {
  let out = '';
  const portPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start within ${timeoutMs}ms. Output: ${out.slice(-2000)}`)), timeoutMs);
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
    proc.on('exit', (code) => reject(new Error(`server exited with code ${code}. Output: ${out.slice(-2000)}`)));
  });
  const port = await portPromise;
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/config`);
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* still booting */
    }
    if (Date.now() > deadline) throw new Error('api/config did not respond');
    await sleep(250);
  }
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tell-web-routes-'));
  fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1\n');
  fs.writeFileSync(path.join(dir, '.env.example'), 'PORT="3000"\n');
  fs.writeFileSync(path.join(dir, 'hello.txt'), 'hi\n');
  const env = { ...process.env, PORT: '0' };
  delete env.TELL_TOKEN;
  child = spawn(process.execPath, [TSX_CLI, 'server.ts', '--cwd', dir], {
    cwd: WEB_SRC,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await waitForServer(child);
});

after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe('api routes (task_build)', () => {
  it('traversal returns 403', async () => {
    const res = await fetch(`${base}/api/file?path=${encodeURIComponent('../outside.txt')}`);
    assert.strictEqual(res.status, 403);
  });

  it('.env returns 403', async () => {
    const res = await fetch(`${base}/api/file?path=${encodeURIComponent('.env')}`);
    assert.strictEqual(res.status, 403);
  });

  it('.env.example is served (not a secret)', async () => {
    const res = await fetch(`${base}/api/file?path=${encodeURIComponent('.env.example')}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.content.includes('PORT='));
  });

  it('/tell with an invalid payload returns 400', async () => {
    const res = await fetch(`${base}/api/tell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });

  it('/snapshot returns name', async () => {
    const res = await fetch(`${base}/api/session/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: {} }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.name === 'string' && body.name.length > 0);
  });

  it('/api/config exposes the sandbox cwd', async () => {
    const res = await fetch(`${base}/api/config`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.cwd, dir);
  });
});
