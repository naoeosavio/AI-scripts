// Chat-thread store rules: section permanence (never zero threads), title hygiene
// (chain feedback excluded), duplication/fork identity, corruption recovery.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadModule } from './helper.js';

const {
  threadTitleFromMessages,
  cloneMessagesWithIds,
  duplicateThread,
  forkThreadFromMessage,
  deleteThreadFromList,
  sanitizeThreads,
  resolveActiveThreadId,
} = loadModule('chat-threads.ts');

let seq = 0;
const rid = () => `id-${++seq}`;
const NOW = '2026-09-07T00:00:00.000Z';

function msg(role, content, id = rid()) {
  return { id, role, content };
}
function thread(title, messages, id = rid()) {
  return { id, title, createdAt: NOW, updatedAt: NOW, messages };
}

describe('threadTitleFromMessages', () => {
  it('uses the first genuine user prompt', () => {
    assert.strictEqual(threadTitleFromMessages([msg('user', 'explain this directory')]), 'explain this directory');
  });

  it('ignores chain-loop feedback when titling', () => {
    const title = threadTitleFromMessages([
      msg('user', 'run it'),
      msg('assistant', 'ok <RUN>ls</RUN>'),
      msg('user', 'Executed command:\nls\nOutput:\nbin'),
    ]);
    assert.strictEqual(title, 'run it');
  });

  it('truncates long prompts and falls back for empties', () => {
    assert.ok(threadTitleFromMessages([msg('user', 'x'.repeat(100))]).endsWith('…'));
    assert.strictEqual(threadTitleFromMessages([]), 'New conversation');
  });
});

describe('duplicateThread', () => {
  it('copies messages with fresh ids and a (copy) title', () => {
    const src = thread('topic', [msg('user', 'hi', 'm1')]);
    const copy = duplicateThread(src, rid, NOW);
    assert.notStrictEqual(copy.id, src.id);
    assert.strictEqual(copy.title, 'topic (copy)');
    assert.strictEqual(copy.messages.length, 1);
    assert.notStrictEqual(copy.messages[0].id, 'm1');
    assert.strictEqual(copy.messages[0].content, 'hi');
    assert.strictEqual(src.messages[0].id, 'm1', 'source untouched');
  });
});

describe('forkThreadFromMessage', () => {
  it('slices up to and including the message with fresh ids', () => {
    const src = thread('topic', [msg('user', 'a', 'm1'), msg('assistant', 'b', 'm2'), msg('user', 'c', 'm3')]);
    const fork = forkThreadFromMessage(src, 1, rid, NOW);
    assert.ok(fork);
    assert.strictEqual(fork.messages.length, 2);
    assert.ok(fork.title.endsWith('(fork)'));
    assert.ok(fork.messages.every((m) => m.id !== 'm1' && m.id !== 'm2'));
  });

  it('rejects out-of-range indices', () => {
    const src = thread('t', [msg('user', 'a')]);
    assert.strictEqual(forkThreadFromMessage(src, -1, rid, NOW), null);
    assert.strictEqual(forkThreadFromMessage(src, 5, rid, NOW), null);
  });
});

describe('deleteThreadFromList', () => {
  it('keeps the stored selection when deleting another thread', () => {
    const a = thread('a', []);
    const b = thread('b', []);
    const next = deleteThreadFromList({ threads: [a, b], activeId: a.id }, b.id, rid, NOW);
    assert.deepStrictEqual(next.threads.map((t) => t.id), [a.id]);
    assert.strictEqual(next.activeId, a.id);
  });

  it('moves selection when deleting the active thread', () => {
    const a = thread('a', []);
    const b = thread('b', []);
    const next = deleteThreadFromList({ threads: [a, b], activeId: a.id }, a.id, rid, NOW);
    assert.strictEqual(next.activeId, b.id);
  });

  it('never leaves zero sections (recreates a fresh thread)', () => {
    const only = thread('solo', [msg('user', 'x')]);
    const next = deleteThreadFromList({ threads: [only], activeId: only.id }, only.id, rid, NOW);
    assert.strictEqual(next.threads.length, 1);
    assert.strictEqual(next.threads[0].messages.length, 0);
  });
});

describe('sanitize + resolveActiveThreadId (permanence across reloads)', () => {
  it('repairs missing message ids and drops id-less threads', () => {
    const clean = sanitizeThreads(
      [{ id: 't1', title: 't', createdAt: NOW, updatedAt: NOW, messages: [{ role: 'user', content: 'x' }] }, { title: 'junk' }],
      rid,
    );
    assert.strictEqual(clean.length, 1);
    assert.ok(typeof clean[0].messages[0].id === 'string');
  });

  it('falls back when the stored active id is gone', () => {
    const a = thread('a', []);
    assert.strictEqual(resolveActiveThreadId([a], 'ghost'), a.id);
    assert.strictEqual(resolveActiveThreadId([a], a.id), a.id);
  });

  it('cloneMessagesWithIds preserves order and content', () => {
    const cloned = cloneMessagesWithIds([msg('user', 'a', 'x'), msg('assistant', 'b', 'y')], rid);
    assert.deepStrictEqual(cloned.map((m) => [m.role, m.content]), [['user', 'a'], ['assistant', 'b']]);
  });
});
