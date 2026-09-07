import { Plus, Copy, GitFork, Trash2, MessagesSquare } from 'lucide-react';
import type { ChatMessage } from './ChatSection.tsx';
import {
  threadTitleFromMessages as pureThreadTitle,
  sanitizeThreads as pureSanitizeThreads,
  resolveActiveThreadId as pureResolveActiveThreadId,
} from '../../chat-threads.ts';
import type { ChatThread as PureChatThread } from '../../chat-threads.ts';
export {
  duplicateThread,
  forkThreadFromMessage,
  deleteThreadFromList,
  cloneMessagesWithIds,
} from '../../chat-threads.ts';

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const THREADS_KEY = 'tell-chat-threads-v1';
const ACTIVE_KEY = 'tell-chat-active-thread-v1';

export function threadTitleFromMessages(messages: ChatMessage[]): string {
  return pureThreadTitle(messages as PureChatThread['messages']);
}

function newThread(): ChatThread {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: 'Nova conversa', createdAt: now, updatedAt: now, messages: [] };
}

export function loadThreads(): { threads: ChatThread[]; activeId: string } {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    const activeId = localStorage.getItem(ACTIVE_KEY) || '';
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const threads = pureSanitizeThreads(parsed, () => crypto.randomUUID()) as ChatThread[];
        if (threads.length > 0) {
          return { threads, activeId: pureResolveActiveThreadId(threads, activeId) };
        }
      }
    }
  } catch {
    /* corrupted storage -> fresh */
  }
  const t = newThread();
  return { threads: [t], activeId: t.id };
}

export function saveThreads(threads: ChatThread[], activeId: string) {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    localStorage.setItem(ACTIVE_KEY, activeId);
  } catch {
    /* storage full/blocked */
  }
}

interface ChatThreadsProps {
  threads: ChatThread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onFork: () => void;
  onDelete: (id: string) => void;
  layout?: 'vertical' | 'horizontal';
  collapsed?: boolean;
}

export default function ChatThreads({
  threads,
  activeId,
  onSelect,
  onNew,
  onDuplicate,
  onFork,
  onDelete,
  layout = 'vertical',
  collapsed = false,
}: ChatThreadsProps) {
  const active = threads.find((t) => t.id === activeId);
  const isHorizontal = layout === 'horizontal';

  // Collapsed panel is just a thin border (toggle lives in the navbar).
  if (collapsed) {
    return (
      <div
        aria-hidden="true"
        className={
          isHorizontal
            ? 'shrink-0 h-1 border-b border-(--color-border-subtle) bg-(--color-bg-primary) select-none'
            : 'h-full w-1 border-r border-(--color-border-subtle) bg-(--color-bg-primary) select-none overflow-hidden'
        }
      />
    );
  }

  return (
    <div
      className={
        isHorizontal
          ? 'shrink-0 flex items-center gap-1.5 px-2 py-1.5 bg-(--color-bg-secondary) border-b border-(--color-border-subtle) overflow-x-auto custom-scrollbar select-none'
          : 'h-full flex flex-col bg-(--color-bg-secondary) border-r border-(--color-border-subtle) select-none overflow-hidden'
      }
    >
      {!isHorizontal && (
        <div className="flex items-center justify-between px-2.5 py-2 border-b border-(--color-border-subtle) shrink-0">
          <span className="flex items-center gap-1.5 text-[9px] font-display font-black uppercase tracking-widest text-(--color-text-secondary)">
            <MessagesSquare className="w-3 h-3 text-(--color-accent)" />
            Conversas
          </span>
          <button
            onClick={onNew}
            title="Nova conversa"
            className="p-1 text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isHorizontal && (
        <button
          onClick={onNew}
          title="Nova conversa"
          className="shrink-0 flex items-center gap-1 px-2 py-1 border border-(--color-border-medium) text-[9px] font-bold uppercase tracking-wider text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Nova
        </button>
      )}

      <div
        className={
          isHorizontal
            ? 'flex items-center gap-1 flex-1 min-w-0 overflow-x-auto custom-scrollbar'
            : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1.5 space-y-1'
        }
      >
        {threads.map((t) => {
          const isActive = t.id === activeId;
          return (
            <div
              key={t.id}
              className={
                isHorizontal
                  ? `group/thread shrink-0 max-w-[200px] flex items-center gap-1 pl-2 pr-1 py-1 border text-[10px] font-mono cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-(--color-bg-elevated) border-(--color-accent)/60 text-(--color-text-primary)'
                        : 'bg-white/5 border-(--color-border-subtle) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10'
                    }`
                  : `group/thread flex items-center gap-1 pl-2 pr-1 py-1.5 border text-[10px] font-mono cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-(--color-bg-elevated) border-(--color-accent)/60 text-(--color-text-primary)'
                        : 'bg-white/5 border-(--color-border-subtle) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10'
                    }`
              }
              onClick={() => onSelect(t.id)}
              title={`${t.title} (${t.messages.length} msg)`}
            >
              <span className="truncate flex-1 min-w-0">{t.title}</span>
              <span className="text-[8px] text-(--color-text-muted) shrink-0">{t.messages.length}</span>
              {threads.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Deletar "${t.title}"?`)) onDelete(t.id);
                  }}
                  title={`Deletar "${t.title}"`}
                  className="shrink-0 p-0.5 opacity-0 group-hover/thread:opacity-100 focus-visible:opacity-100 focus:opacity-100 hover:text-(--color-error) transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isHorizontal && active && (
        <div className="shrink-0 border-t border-(--color-border-subtle) p-1.5 grid grid-cols-2 gap-1">
          <button
            onClick={onDuplicate}
            title="Duplicar conversa atual"
            className="flex items-center justify-center gap-1 px-1 py-1.5 border border-(--color-border-medium) text-[8px] font-bold uppercase tracking-wider text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3" /> Duplicar
          </button>
          <button
            onClick={onFork}
            title="Fork da conversa atual"
            className="flex items-center justify-center gap-1 px-1 py-1.5 border border-(--color-border-medium) text-[8px] font-bold uppercase tracking-wider text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10 transition-colors cursor-pointer"
          >
            <GitFork className="w-3 h-3" /> Fork
          </button>
        </div>
      )}
    </div>
  );
}
