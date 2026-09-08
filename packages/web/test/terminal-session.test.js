// Session permanence for the terminal section: renames, new tabs and the
// active tab must survive save/load (the Agent<->Terminal reset class of bug),
// and snapshots must carry the same layout.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModule } from './helper.js';

const { emptySession, saveSession, loadSession, createSnapshot } = loadModule('session.ts');
const { parsePersistedTerminalLayout } = loadModule('terminal-layout.ts');

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tell-web-term-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function renamedLayout() {
  return {
    tabs: [
      { id: 't-op', name: 'opencode', panes: [{ id: 'p1', title: 'bash', scrollback: '' }], activePaneId: 'p1' },
      { id: 't-lz', name: '10: session-10', panes: [{ id: 'p2', title: 'bash', scrollback: '' }], activePaneId: 'p2' },
    ],
    activeTabId: 't-lz',
  };
}

describe('terminal section permanence', () => {
  it('save/load preserves renames, new tabs and the active tab', () => {
    const s = emptySession(dir);
    s.terminal = renamedLayout();
    assert.strictEqual(saveSession(dir, s), true);
    const loaded = loadSession(dir);
    assert.deepStrictEqual(loaded.terminal.tabs.map((t) => t.name), ['opencode', '10: session-10']);
    assert.strictEqual(loaded.terminal.activeTabId, 't-lz');
  });

  it('snapshots carry the terminal layout at snapshot time', () => {
    const s = emptySession(dir);
    s.terminal = renamedLayout();
    const name = createSnapshot(dir, s);
    assert.ok(name);
    const snap = JSON.parse(fs.readFileSync(path.join(dir, '.tell', 'history', name), 'utf8'));
    assert.strictEqual(snap.terminal.tabs.length, 2);
    assert.strictEqual(snap.terminal.activeTabId, 't-lz');
  });

  it('a reloaded layout still parses for the UI layer', () => {
    const s = emptySession(dir);
    s.terminal = renamedLayout();
    saveSession(dir, s);
    const loaded = loadSession(dir);
    const parsed = parsePersistedTerminalLayout(loaded.terminal);
    assert.ok(parsed);
    assert.strictEqual(parsed.tabs.length, 2);
  });

  it('execution feedback messages persist as session messages (chain continuity)', () => {
    const s = emptySession(dir);
    s.messages = [
      { role: 'user', content: 'run it' },
      { role: 'assistant', content: 'ok <RUN>ls</RUN>' },
      { role: 'user', content: 'Executed command:\nls\nOutput:\nbin' },
    ];
    assert.strictEqual(saveSession(dir, s), true);
    const loaded = loadSession(dir);
    assert.strictEqual(loaded.messages.length, 3);
    assert.ok(loaded.messages[2].content.startsWith('Executed command:'));
  });
});
