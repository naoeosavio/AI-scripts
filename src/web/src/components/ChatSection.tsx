import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Sparkles, BrainCircuit, Terminal, Check, Copy, Square, ArrowDown, Minimize2 } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string | null;
}

export interface ModelInfo {
  alias: string;
  spec: string;
  vendor: string;
  model: string;
  thinking: string;
  fast: boolean;
}

interface ChatSectionProps {
  messages: ChatMessage[];
  inputPrompt: string;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  loading: boolean;
  modelAlias: string;
  onModelAliasChange: (alias: string) => void;
  models: ModelInfo[];
  keysStatus: Record<string, boolean>;
  chainMode: boolean;
  onChainModeChange: (val: boolean) => void;
  autoExecute: boolean;
  onAutoExecuteChange: (val: boolean) => void;
  onSelectSample: (prompt: string) => void;
  onMinimize?: () => void;
}

const SAMPLE_PROMPTS = [
  { label: '🔍 Structure', prompt: 'explain this directory and list the contents' },
  { label: '💾 Write Script', prompt: 'save a demo file called hello.ts with a console log and show it' },
  { label: '🧪 Lint Workspace', prompt: 'run the workspace linter command and report if there are any issues' },
  { label: '🛠️ Sys Information', prompt: 'create a script to print system info and run it' },
];

// Vendors that require an API key (vast/local are keyless endpoints)
const KEYED_VENDORS = new Set(['openai', 'anthropic', 'google', 'xai', 'deepseek', 'fireworks', 'openrouter', 'moonshotai', 'cerebras']);
const VENDOR_KEY_ALIASES: Record<string, string> = { google: 'google' };

// Autoscroll only sticks when the user is already this close to the bottom
const NEAR_BOTTOM_PX = 80;
// Feedback messages longer than this render collapsed (<details>)
const FEEDBACK_COLLAPSE_CHARS = 400;
// Hard cap for the prompt textarea
const MAX_INPUT_CHARS = 8000;

const FEEDBACK_PREFIX_RE = /^(Executed command|Skipped by user):/;

export default function ChatSection({
  messages,
  inputPrompt,
  onInputChange,
  onSubmit,
  onStop,
  loading,
  modelAlias,
  onModelAliasChange,
  models,
  keysStatus,
  chainMode,
  onChainModeChange,
  autoExecute,
  onAutoExecuteChange,
  onSelectSample,
  onMinimize,
}: ChatSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distance < NEAR_BOTTOM_PX;
    if (nearBottomRef.current) setShowJump(false);
  }, []);

  // Stick to bottom only when already near it; otherwise offer a jump button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setShowJump(false);
    } else {
      setShowJump(true);
    }
  }, [messages]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  // Helper to strip <RUN> tags (case-insensitive) from text response so they don't pollute the visual bubble
  const cleanResponseContent = (text: string) => {
    return text.replace(/<run>[\s\S]*?<\/run>/gi, '').trim();
  };

  const hasRunsInMessage = (text: string) => {
    return /<run>[\s\S]*?<\/run>/i.test(text);
  };

  const selectedModel = models.find((m) => m.alias === modelAlias);
  const hasKey = (vendor: string) => !KEYED_VENDORS.has(vendor) || !!keysStatus[VENDOR_KEY_ALIASES[vendor] || vendor];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!loading && inputPrompt.trim()) formRef.current?.requestSubmit();
    }
  };

  const renderFeedbackBody = (content: string) => {
    const nl = content.indexOf('\n');
    const header = nl >= 0 ? content.slice(0, nl) : content;
    return (
      <details className="w-full group">
        <summary className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-wider text-(--color-accent-text) hover:text-(--color-accent) transition-colors list-none flex items-center gap-1.5">
          <Terminal className="w-3 h-3 shrink-0" />
          <span className="truncate">{header}</span>
          <span className="text-(--color-text-muted) font-normal normal-case group-open:hidden">· expand</span>
        </summary>
        <pre className="mt-2 p-2 bg-(--color-bg-primary) border border-(--color-border-subtle) text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scrollbar select-text">
          {content}
        </pre>
      </details>
    );
  };

  return (
    <div className="relative flex flex-col h-full bg-(--color-bg-primary)">
      {/* Top Navbar */}
      <div className="flex flex-wrap items-center justify-between p-4 border-b border-(--color-border-subtle) bg-(--color-bg-primary) text-(--color-text-primary) gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-(--color-accent) animate-pulse" />
          <span className="font-display font-black text-xs tracking-[0.2em] uppercase text-(--color-text-primary)">
            Chat Interface
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <span className="text-(--color-text-muted) uppercase tracking-widest text-[9px] font-bold">Model:</span>
            <select
              value={modelAlias}
              onChange={(e) => onModelAliasChange(e.target.value)}
              title={selectedModel && !hasKey(selectedModel.vendor) ? 'sem chave' : undefined}
              className="bg-(--color-bg-secondary) border border-(--color-border-medium) rounded-none px-2.5 py-1 text-(--color-text-primary) font-mono text-[10px] focus:outline-none focus:border-(--color-text-primary) transition-colors cursor-pointer uppercase"
            >
              {models.map((m) => (
                <option key={m.alias} value={m.alias} disabled={!hasKey(m.vendor)} className="bg-(--color-bg-primary)">
                  {m.alias} : {m.vendor.toUpperCase()}
                  {!hasKey(m.vendor) ? ' (sem chave)' : m.fast ? ' · fast' : m.thinking && m.thinking !== 'none' ? ` · ${m.thinking}` : ''}
                </option>
              ))}
            </select>
            {selectedModel && (
              <span className="flex items-center gap-1">
                {selectedModel.fast ? (
                  <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.2 border border-(--color-accent)/40 bg-(--color-accent-subtle) text-(--color-accent-text)">
                    ⚡ Fast
                  </span>
                ) : (
                  selectedModel.thinking && selectedModel.thinking !== 'none' && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.2 border border-(--color-border-medium) bg-white/5 text-(--color-text-secondary)">
                      🧠 {selectedModel.thinking}
                    </span>
                  )
                )}
              </span>
            )}
          </div>

          {/* Chain Mode Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
            <input
              type="checkbox"
              checked={chainMode}
              onChange={(e) => onChainModeChange(e.target.checked)}
              className="accent-(--color-accent) rounded-none bg-(--color-bg-secondary) border-(--color-border-medium) focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
            <span className="font-bold tracking-wider text-[9px] uppercase">Chain Loop</span>
          </label>

          {/* Yes Auto Execute Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
            <input
              type="checkbox"
              checked={autoExecute}
              onChange={(e) => onAutoExecuteChange(e.target.checked)}
              className="accent-(--color-accent) rounded-none bg-(--color-bg-secondary) border-(--color-border-medium) focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
            <span className="font-bold tracking-wider text-[9px] uppercase">Auto-Run (-y)</span>
          </label>

          {onMinimize && (
            <button
              onClick={onMinimize}
              title="Minimizar chat — mostrar console"
              className="p-1.5 border border-(--color-border-subtle) hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar select-text bg-(--color-bg-primary) relative"
      >
        {/* Subtle grid line backdrop for premium brutalist look */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none grid grid-cols-6 h-full w-full">
          <div className="border-r border-(--color-text-primary) h-full"></div>
          <div className="border-r border-(--color-text-primary) h-full"></div>
          <div className="border-r border-(--color-text-primary) h-full"></div>
          <div className="border-r border-(--color-text-primary) h-full"></div>
          <div className="border-r border-(--color-text-primary) h-full"></div>
        </div>

        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center max-w-xl mx-auto space-y-8 pt-8 relative z-10">
            {/* Elegant Top Annotation */}
            <div className="text-[10px] font-bold tracking-[0.5em] text-(--color-text-muted) uppercase">
              [ Sandbox Assistant v1.2 ]
            </div>

            {/* Massive Displays Slogan from Design HTML */}
            <div className="space-y-2 select-none">
              <h1 className="text-7xl sm:text-8xl font-black leading-[0.85] uppercase tracking-tighter -ml-1 text-(--color-text-primary)">
                Speak<br/>Deeply.
              </h1>
              <div className="mt-4 flex gap-4 items-center">
                <div className="h-[1px] w-12 bg-(--color-border-medium)"></div>
                <p className="text-sm font-light leading-relaxed tracking-tight text-(--color-text-secondary) italic">
                  Tell your story. The engine is mapping your terminal directives to a synthetic reality in real-time.
                </p>
              </div>
            </div>

            {/* Quick Actions / Sample Accelerator styled exactly like the synthesis badges in the design */}
            <div className="space-y-2">
              <div className="text-[9px] uppercase font-bold tracking-[0.2em] text-(--color-text-muted)">
                Synthesis Anchors
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 select-none">
                {SAMPLE_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectSample(sample.prompt)}
                    className="px-4 py-2.5 border border-(--color-border-subtle) text-left text-[10px] font-bold uppercase tracking-widest text-(--color-text-primary) hover:bg-(--color-text-primary) hover:text-(--color-bg-primary) hover:border-(--color-text-primary) transition-all duration-150 cursor-pointer rounded-none font-display"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            const cleanContent = isUser ? m.content : cleanResponseContent(m.content);
            const containsRuns = !isUser && hasRunsInMessage(m.content);
            const isFeedback = isUser && FEEDBACK_PREFIX_RE.test(m.content);

            // Skip rendering if content is empty (e.g. intermediate thought only messages or silent system runs)
            if (!cleanContent && !m.thought) return null;

            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl mx-auto relative z-10 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 bg-white/5 border border-(--color-border-medium) text-(--color-text-primary) rounded-none flex items-center justify-center shrink-0 select-none">
                    <BrainCircuit className="w-4 h-4 text-(--color-accent)" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className="space-y-2 max-w-[85%] min-w-0">
                  {/* Thought/Reasoning Panel */}
                  {m.thought && (
                    <div className="bg-(--color-bg-secondary) border-l-2 border-(--color-accent) p-3.5 text-[11px] text-(--color-text-secondary) font-mono space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] text-(--color-text-muted) font-bold uppercase tracking-widest select-none">
                        <BrainCircuit className="w-3.5 h-3.5 text-(--color-accent)" />
                        <span>Cognitive Sequence</span>
                      </div>
                      <div className="leading-relaxed pl-1 whitespace-pre-wrap">
                        {typeof m.thought === 'string'
                          ? m.thought
                          : typeof m.thought === 'object' && m.thought !== null
                          ? (m.thought as any).text || JSON.stringify(m.thought, null, 2)
                          : String(m.thought)}
                      </div>
                    </div>
                  )}

                  {cleanContent && (
                    <div
                      className={`p-4 rounded-none text-xs leading-relaxed group ${
                        isUser
                          ? 'bg-white/5 text-(--color-text-primary) border border-(--color-border-medium) selection:bg-(--color-accent-subtle)'
                          : 'bg-(--color-bg-secondary) text-(--color-text-primary) border border-(--color-border-subtle) selection:bg-(--color-accent-subtle)'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                        {isFeedback && m.content.length > FEEDBACK_COLLAPSE_CHARS ? renderFeedbackBody(m.content) : cleanContent}
                      </div>

                      {/* Run tag notification inside chat bubble */}
                      {containsRuns && (
                        <div className="mt-3 flex items-center gap-2 text-[10px] bg-(--color-accent-subtle) text-(--color-accent-text) border border-(--color-accent)/25 px-2.5 py-1.5 rounded-none font-mono tracking-wide select-none">
                          <Terminal className="w-3.5 h-3.5 shrink-0" />
                          <span className="uppercase font-bold">SCRIPT GENERATED IN TERMINAL PIPELINE</span>
                        </div>
                      )}

                      {/* Copy assistant answers */}
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(m.id, cleanContent)}
                          title="Copy answer"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-(--color-text-muted) hover:text-(--color-text-primary) cursor-pointer"
                        >
                          {copiedId === m.id ? <Check className="w-3 h-3 text-(--color-success)" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 bg-(--color-text-primary) text-(--color-bg-primary) rounded-none flex items-center justify-center shrink-0 select-none font-mono font-bold text-xs border border-(--color-border-medium)">
                    U
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Jump-to-new-message button */}
      {showJump && (
        <button
          onClick={() => {
            nearBottomRef.current = true;
            setShowJump(false);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-(--color-accent) text-white text-[9px] font-black uppercase tracking-widest shadow-lg cursor-pointer hover:bg-(--color-accent-hover) transition-colors"
        >
          <ArrowDown className="w-3 h-3" />
          novo
        </button>
      )}

      {/* Message Input Bar */}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="p-4 border-t border-(--color-border-subtle) bg-(--color-bg-primary) select-none shrink-0"
      >
        <div className="flex items-end gap-3 max-w-3xl mx-auto bg-(--color-bg-secondary) border border-(--color-border-medium) px-3 py-1">
          <textarea
            value={inputPrompt}
            onChange={(e) => onInputChange(e.target.value.slice(0, MAX_INPUT_CHARS))}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            maxLength={MAX_INPUT_CHARS}
            placeholder={loading ? "PROCESSOR EXECUTING LOOP..." : "PROMPT CONSOLE FOR DIRECTIVES... (Shift+Enter = newline)"}
            className="flex-1 bg-transparent border-none py-2 text-xs text-(--color-text-primary) placeholder-white/35 focus:outline-none leading-relaxed font-sans select-text tracking-wide resize-none max-h-32 overflow-y-auto custom-scrollbar"
          />
          {inputPrompt.length > 0 && (
            <span className="text-[8px] font-mono text-(--color-text-muted) pb-2 shrink-0 select-none">
              {inputPrompt.length}/{MAX_INPUT_CHARS}
            </span>
          )}
          {loading ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generation / chain"
              className="p-2 bg-(--color-error) text-white hover:opacity-80 transition-all duration-150 rounded-none shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputPrompt.trim()}
              className="p-2 bg-(--color-text-primary) text-(--color-bg-primary) hover:bg-(--color-accent) hover:text-white disabled:bg-white/10 disabled:text-(--color-text-muted) transition-all duration-150 rounded-none shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
