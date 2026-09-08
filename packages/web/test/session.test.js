// session without sleep: mtimeMs mocked via utimesSync (deterministic on coarse filesystems).

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { loadModule } from './helper.js';

const { emptySession, saveSession, loadSession, createSnapshot, listHistory, sessionPath, historyDir } =
  loadModule('session.ts');

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tell-web-session-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function setMtime(file, ms) {
  const d = new Date(ms);
  fs.utimesSync(file, d, d);
}

describe('deterministic session mtime', () => {
  it('save/load preserves updatedAt without sleeping', () => {
    const s = emptySession(dir);
    assert.strictEqual(saveSession(dir, s), true);
    const loaded = loadSession(dir);
    assert.ok(loaded);
    assert.strictEqual(typeof loaded.updatedAt, 'string');
  });

  it('listHistory sorts by mocked mtimeMs (no flakes)', () => {
    const s = emptySession(dir);
    const first = createSnapshot(dir, s);
    const second = createSnapshot(dir, s);
    assert.ok(first && second);
    // Force-invert: first becomes the newest via mocked mtime.
    const now = Date.now();
    setMtime(path.join(historyDir(dir), second), now - 60_000);
    setMtime(path.join(historyDir(dir), first), now);
    const history = listHistory(dir);
    assert.strictEqual(history[0].name, first);
    assert.strictEqual(history[history.length - 1].name, second);
  });

  it('saveSession writes a file whose mtime tracks updatedAt', () => {
    const s = emptySession(dir);
    saveSession(dir, s);
    const stat = fs.statSync(sessionPath(dir));
    const loaded = loadSession(dir);
    assert.ok(Math.abs(new Date(loaded.updatedAt).getTime() - stat.mtimeMs) < 5000);
  });
});
