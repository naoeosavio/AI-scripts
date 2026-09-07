// Pure chat-thread helpers (no React/DOM): title, duplicate, fork, delete.
// The .tsx component owns rendering/localStorage; all list math lives here
// so the section/duplication bugs are pinned by tests.
import type { ChatMessage } from './src/components/ChatSection.tsx';

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export const THREAD_TITLE_MAX = 42;

export function isChainFeedbackContent(content: string): boolean {
  return /^(Executed command|Skipped by user):/.test(content);
}

export function threadTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && !isChainFeedbackContent(m.content));
  const raw = (firstUser?.content ?? messages[0]?.content ?? 'Nova conversa').trim().replace(/\s+/g, ' ');
  return raw.length > THREAD_TITLE_MAX ? `${raw.slice(0, THREAD_TITLE_MAX)}…` : raw || 'Nova conversa';
}

export function cloneMessagesWithIds(messages: ChatMessage[], randomId: () => string): ChatMessage[] {
  return messages.map((m) => ({ ...m, id: randomId() }));
}

export function makeThread(
  messages: ChatMessage[],
  title: string,
  randomId: () => string,
  nowIso: string,
): ChatThread {
  return { id: randomId(), title, createdAt: nowIso, updatedAt: nowIso, messages };
}

/** Full copy of the active thread (new identity, fresh message ids). */
export function duplicateThread(
  active: ChatThread,
  randomId: () => string,
  nowIso: string,
): ChatThread {
  return makeThread(
    cloneMessagesWithIds(active.messages, randomId),
    `${active.title} (cópia)`,
    randomId,
    nowIso,
  );
}

/** Fork: copy of messages up to and including `uptoIndex`. Returns null for bad index. */
export function forkThreadFromMessage(
  source: ChatThread,
  uptoIndex: number,
  randomId: () => string,
  nowIso: string,
): ChatThread | null {
  if (uptoIndex < 0 || uptoIndex >= source.messages.length) return null;
  const sliced = cloneMessagesWithIds(source.messages.slice(0, uptoIndex + 1), randomId);
  return makeThread(sliced, `${threadTitleFromMessages(sliced)} (fork)`, randomId, nowIso);
}

export interface ThreadList {
  threads: ChatThread[];
  activeId: string;
}

/**
 * Delete a thread. Never returns an empty list: deleting the last thread
 * yields a fresh empty one (prevents a zero-section state).
 */
export function deleteThreadFromList(
  list: ThreadList,
  id: string,
  randomId: () => string,
  nowIso: string,
): ThreadList {
  const filtered = list.threads.filter((t) => t.id !== id);
  if (filtered.length === 0) {
    const fresh = makeThread([], 'Nova conversa', randomId, nowIso);
    return { threads: [fresh], activeId: fresh.id };
  }
  const activeId = list.activeId === id ? (filtered[0]?.id ?? '') : list.activeId;
  return { threads: filtered, activeId };
}

/** Drop corrupted entries; guarantee message ids. */
export function sanitizeThreads(raw: unknown, randomId: () => string): ChatThread[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((t): t is ChatThread => !!t && typeof t === 'object' && typeof (t as ChatThread).id === 'string')
    .map((t) => ({
      ...(t as ChatThread),
      messages: Array.isArray((t as ChatThread).messages)
        ? (t as ChatThread).messages.map((m) => ({
            ...m,
            id: typeof m.id === 'string' ? m.id : randomId(),
          }))
        : [],
    }));
}

/** Keep the stored active id only when it still exists. */
export function resolveActiveThreadId(threads: ChatThread[], activeId: string): string {
  if (threads.some((t) => t.id === activeId)) return activeId;
  return threads[0]?.id ?? activeId;
}
