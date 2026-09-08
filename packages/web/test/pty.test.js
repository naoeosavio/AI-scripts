// pushScrollback 50KB truncation + GC schedule/cancel (no long sleeps, no real node-pty).
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadModule } from './helper.js';

const {
  pushScrollback,
  scheduleGcTimer,
  cancelGcTimer,
  MAX_SCROLLBACK_CHARS,
  GC_AFTER_MS,
} = loadModule('pty.ts');

function blankTimer() {
  return { timer: null, lastDisconnect: null };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('pty scrollback', () => {
  it('truncates at 50KB keeping the tail', () => {
    assert.strictEqual(MAX_SCROLLBACK_CHARS, 50 * 1024);
    const buf = { scrollback: [], scrollbackChars: 0 };
    pushScrollback(buf, 'a'.repeat(40 * 1024));
    pushScrollback(buf, 'b'.repeat(40 * 1024));
    assert.ok(buf.scrollbackChars <= MAX_SCROLLBACK_CHARS);
    assert.ok(buf.scrollback.join('').endsWith('b'.repeat(10)));
    assert.ok(!buf.scrollback.join('').startsWith('a'));
  });

  it('accumulates below the limit without truncating', () => {
    const buf = { scrollback: [], scrollbackChars: 0 };
    pushScrollback(buf, 'hello');
    pushScrollback(buf, ' world');
    assert.strictEqual(buf.scrollback.join(''), 'hello world');
    assert.strictEqual(buf.scrollbackChars, 11);
  });
});

describe('pty GC schedule/cancel', () => {
  it(`GC_AFTER_MS is 5min (${GC_AFTER_MS})`, () => {
    assert.strictEqual(GC_AFTER_MS, 5 * 60 * 1000);
  });

  it('schedules the timer and fires onExpire', async () => {
    const state = blankTimer();
    let fired = 0;
    scheduleGcTimer(state, () => {
      fired += 1;
    }, 10);
    assert.ok(state.timer !== null);
    assert.ok(typeof state.lastDisconnect === 'number');
    await sleep(50);
    assert.strictEqual(fired, 1);
    assert.strictEqual(state.timer, null);
  });

  it('re-scheduling cancels the previous timer', async () => {
    const state = blankTimer();
    let fired = 0;
    scheduleGcTimer(state, () => {
      fired += 1;
    }, 10);
    const first = state.timer;
    scheduleGcTimer(state, () => {
      fired += 10;
    }, 40);
    assert.notStrictEqual(state.timer, first);
    await sleep(60);
    assert.strictEqual(fired, 10);
  });

  it('cancelGcTimer prevents the firing', async () => {
    const state = blankTimer();
    let fired = 0;
    scheduleGcTimer(state, () => {
      fired += 1;
    }, 10);
    cancelGcTimer(state);
    assert.strictEqual(state.timer, null);
    await sleep(40);
    assert.strictEqual(fired, 0);
  });
});
