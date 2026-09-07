// Chain-feedback presentation rules: execution outputs are stored as role:'user'
// (LLM context unchanged) but must render on the LLM side; SCRIPT expanders
// show the linked result. Guards the "executed command on the user side" bug.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadModule } from './helper.js';

const {
  FEEDBACK_PREFIX_RE,
  isChainFeedback,
  isChainFeedbackMessage,
  parseFeedback,
  findLinkedFeedbackIndex,
  displaySideFor,
  defaultFeedbackOpen,
} = loadModule('chain-feedback.ts');

const CMD = 'touch system-info.js && chmod +x system-info.js';
const OUT = 'created\nok';

function executed(command = CMD, output = OUT) {
  return `Executed command:\n${command}\nOutput:\n${output}`;
}

describe('chain-feedback detection', () => {
  it('matches Executed/Skipped prefixes only', () => {
    assert.ok(FEEDBACK_PREFIX_RE.test(executed()));
    assert.ok(FEEDBACK_PREFIX_RE.test('Skipped by user:\nls'));
    assert.ok(!FEEDBACK_PREFIX_RE.test('Executed commands list'));
    assert.ok(!FEEDBACK_PREFIX_RE.test('explain this directory'));
  });

  it('isChainFeedbackMessage requires role user', () => {
    assert.ok(isChainFeedbackMessage({ role: 'user', content: executed() }));
    assert.ok(!isChainFeedbackMessage({ role: 'assistant', content: executed() }));
    assert.ok(!isChainFeedbackMessage({ role: 'user', content: 'hello' }));
  });
});

describe('parseFeedback', () => {
  it('splits command and output', () => {
    const parsed = parseFeedback(executed());
    assert.strictEqual(parsed.kind, 'executed');
    assert.strictEqual(parsed.command, CMD);
    assert.strictEqual(parsed.output, OUT);
  });

  it('keeps truncated tails and empty outputs', () => {
    const tail = parseFeedback(`Executed command:\n${CMD}\nOutput:\n…[truncated]\n${OUT}`);
    assert.ok(tail.output.includes('…[truncated]'));
    const empty = parseFeedback(`Executed command:\n${CMD}\nOutput:\n`);
    assert.strictEqual(empty.output, '');
  });

  it('parses skipped commands', () => {
    const parsed = parseFeedback('Skipped by user:\nrm -rf /tmp/x');
    assert.strictEqual(parsed.kind, 'skipped');
    assert.strictEqual(parsed.command, 'rm -rf /tmp/x');
    assert.strictEqual(parsed.output, '');
  });

  it('returns null for non-feedback', () => {
    assert.strictEqual(parseFeedback('just a prompt'), null);
  });
});

describe('findLinkedFeedbackIndex', () => {
  const assistantRun = { id: 'a1', role: 'assistant', content: 'here <RUN>ls</RUN>' };
  const feedback = { id: 'f1', role: 'user', content: executed('ls', 'a\nb') };

  it('links the first feedback after the assistant message', () => {
    const msgs = [{ id: 'u', role: 'user', content: 'list' }, assistantRun, feedback];
    assert.strictEqual(findLinkedFeedbackIndex(msgs, 1), 2);
  });

  it('returns -1 while execution is still pending', () => {
    assert.strictEqual(findLinkedFeedbackIndex([{ id: 'u', role: 'user', content: 'x' }, assistantRun], 1), -1);
  });

  it('stops at the next genuine user prompt (no cross-talk between turns)', () => {
    const msgs = [
      assistantRun,
      { id: 'u2', role: 'user', content: 'another question' },
      { id: 'f2', role: 'user', content: executed('other', 'z') },
    ];
    assert.strictEqual(findLinkedFeedbackIndex(msgs, 0), -1);
  });

  it('skips assistant follow-ups between script and result', () => {
    const msgs = [
      assistantRun,
      { id: 'a2', role: 'assistant', content: 'working on it' },
      feedback,
    ];
    assert.strictEqual(findLinkedFeedbackIndex(msgs, 0), 2);
  });
});

describe('defaultFeedbackOpen', () => {
  it('starts short results expanded and long ones collapsed', () => {
    assert.strictEqual(defaultFeedbackOpen(executed('ls', 'a')), true);
    assert.strictEqual(defaultFeedbackOpen(executed('ls', 'x'.repeat(2000))), false);
  });
});

describe('displaySideFor', () => {
  it('renders chain feedback on the assistant side', () => {
    assert.strictEqual(displaySideFor({ role: 'user', content: executed() }), 'assistant');
    assert.strictEqual(displaySideFor({ role: 'user', content: 'Skipped by user:\nls' }), 'assistant');
  });

  it('keeps genuine prompts and answers on their sides', () => {
    assert.strictEqual(displaySideFor({ role: 'user', content: 'explain this' }), 'user');
    assert.strictEqual(displaySideFor({ role: 'assistant', content: 'sure <RUN>x</RUN>' }), 'assistant');
  });
});
