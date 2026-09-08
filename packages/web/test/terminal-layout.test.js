// Terminal layout invariants: tab renames/new tabs must survive view switches
// (Agent<->Terminal remounts), active ids must never dangle (blank pane grid),
// lateral width stays in 60..200ch, tab numbers never repeat after renames.

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { loadModule } from './helper.js';

const {
  clampTerminalWidthCh,
  resolveSafeActiveTabId,
  maxTabNumber,
  nextTabNumber,
  mergeRestoredTerminalLayout,
  parsePersistedTerminalLayout,
  TERMINAL_WIDTH_CH_MIN,
  TERMINAL_WIDTH_CH_MAX,
} = loadModule('terminal-layout.ts');

function tab(id, name) {
  return { id, name, panes: [{ id: `pane-${id}`, title: 'bash' }], activePaneId: `pane-${id}` };
}

describe('clampTerminalWidthCh', () => {
  it('clamps the lateral width to 60..200ch', () => {
    assert.strictEqual(clampTerminalWidthCh(80), 80);
    assert.strictEqual(clampTerminalWidthCh(1), TERMINAL_WIDTH_CH_MIN);
    assert.strictEqual(clampTerminalWidthCh(9999), TERMINAL_WIDTH_CH_MAX);
    assert.strictEqual(clampTerminalWidthCh(62.4), 62);
  });

  it('falls back to default on garbage', () => {
    assert.strictEqual(clampTerminalWidthCh(undefined), 80);
    assert.strictEqual(clampTerminalWidthCh(NaN), 80);
    assert.strictEqual(clampTerminalWidthCh('wide'), 80);
  });
});

describe('resolveSafeActiveTabId', () => {
  it('keeps a live active id', () => {
    assert.strictEqual(resolveSafeActiveTabId([tab('a', '1: x'), tab('b', '2: y')], 'b'), 'b');
  });

  it('falls back to the first tab when the active id is gone (no blank grid)', () => {
    // Regression: after the double-onTabsChange race the active id pointed
    // nowhere and every pane grid rendered hidden (white/empty terminal).
    assert.strictEqual(resolveSafeActiveTabId([tab('a', '1: x')], 'dangling-id'), 'a');
  });
});

describe('monotonic tab numbering', () => {
  it('ignores non-numeric names from renames', () => {
    assert.strictEqual(maxTabNumber([tab('a', 'opencode'), tab('b', 'lazy')]), 0);
    assert.strictEqual(maxTabNumber([tab('a', '10: session-10')]), 10);
  });

  it('never reuses a number after renames (the "cannot create tabs" class of bug)', () => {
    let seq = 0;
    const tabs = [tab('a', '1: dev-shell')];
    const first = nextTabNumber(seq, tabs);
    seq = first.seq;
    // User renames the only tab to a non-numeric name, then adds another.
    const renamed = [{ ...tabs[0], name: 'o1' }];
    const second = nextTabNumber(seq, renamed);
    assert.ok(second.num > first.num, `reused number: ${second.num} after ${first.num}`);
  });
});

describe('mergeRestoredTerminalLayout', () => {
  it('replaces a virgin default tab outright', () => {
    const prev = [tab('tab-1', '1: dev-shell')];
    prev[0].panes = [{ id: 'pane-1', title: 'bash #1' }];
    prev[0].activePaneId = 'pane-1';
    const restored = { tabs: [tab('srv-1', '3: npm')], activeTabId: 'srv-1' };
    assert.deepStrictEqual(mergeRestoredTerminalLayout(prev, restored), restored.tabs);
  });

  it('preserves local renames and user-only tabs over a stale snapshot', () => {
    // Regression: switching Agent<->Terminal re-adopted the server snapshot
    // and wiped renames + newly created tabs.
    const prev = [tab('srv-1', 'my-rename'), tab('local-9', '9: scratch')];
    const restored = { tabs: [tab('srv-1', '3: npm')], activeTabId: 'srv-1' };
    const merged = mergeRestoredTerminalLayout(prev, restored);
    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged[0].name, 'my-rename');
    assert.strictEqual(merged[1].id, 'local-9');
  });

  it('is a no-op on empty restores', () => {
    const prev = [tab('a', 'o1')];
    assert.deepStrictEqual(mergeRestoredTerminalLayout(prev, { tabs: [], activeTabId: '' }), prev);
  });
});

describe('parsePersistedTerminalLayout', () => {
  it('accepts blobs with tab ids', () => {
    const layout = { tabs: [tab('a', 'o1')], activeTabId: 'a' };
    assert.deepStrictEqual(parsePersistedTerminalLayout(layout), layout);
  });

  it('rejects garbage (falls back to default tab upstream)', () => {
    assert.strictEqual(parsePersistedTerminalLayout(null), null);
    assert.strictEqual(parsePersistedTerminalLayout({ tabs: [] }), null);
    assert.strictEqual(parsePersistedTerminalLayout({ tabs: [{ name: 'no-id' }] }), null);
  });
});
