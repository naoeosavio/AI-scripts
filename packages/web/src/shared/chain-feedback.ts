// Pure chain-feedback helpers (no React): shared by ChatSection rendering and tests.
// Chain-loop execution outputs are appended as role:'user' messages so the LLM
// keeps the tool output in context; the UI renders them on the LLM side.

export const FEEDBACK_PREFIX_RE = /^(Executed command|Skipped by user):/;

/** Feedback cards start minimized (collapsed) by default; the user expands per card. */
export const FEEDBACK_COLLAPSE_CHARS = 400;

export function defaultFeedbackOpen(_content: string): boolean {
  return false;
}

export type FeedbackKind = 'executed' | 'skipped';

export interface ParsedFeedback {
  kind: FeedbackKind;
  command: string;
  output: string;
}

export interface ChainMessageLike {
  id: string;
  role: string;
  content: string;
}

export function isChainFeedback(content: string): boolean {
  return FEEDBACK_PREFIX_RE.test(content);
}

export function isChainFeedbackMessage(m: { role: string; content: string }): boolean {
  return m.role === 'user' && isChainFeedback(m.content);
}

/** Split `Executed command:\n{cmd}\nOutput:\n{out}` / `Skipped by user:\n{cmd}`. */
export function parseFeedback(content: string): ParsedFeedback | null {
  if (!isChainFeedback(content)) return null;
  if (content.startsWith('Skipped by user:')) {
    return { kind: 'skipped', command: content.slice('Skipped by user:'.length).trim(), output: '' };
  }
  const body = content.slice('Executed command:'.length);
  const sep = '\nOutput:\n';
  const idx = body.indexOf(sep);
  if (idx === -1) return { kind: 'executed', command: body.trim(), output: '' };
  return {
    kind: 'executed',
    command: body.slice(0, idx).trim(),
    output: body.slice(idx + sep.length),
  };
}

/**
 * Find the feedback linked to the assistant message at `fromIndex`:
 * the first chain-feedback message after it, stopping at the next genuine
 * user prompt (non-feedback user message) or the end of the list.
 * Returns the message index or -1.
 */
export function findLinkedFeedbackIndex(messages: ChainMessageLike[], fromIndex: number): number {
  for (let j = fromIndex + 1; j < messages.length; j++) {
    const m = messages[j];
    if (!m) continue;
    if (m.role !== 'user') continue;
    if (isChainFeedback(m.content)) return j;
    return -1;
  }
  return -1;
}

/** Presentational side: chain feedback renders on the LLM (left) side. */
export function displaySideFor(m: { role: string; content: string }): 'user' | 'assistant' {
  if (m.role === 'user' && isChainFeedback(m.content)) return 'assistant';
  return m.role === 'user' ? 'user' : 'assistant';
}
