import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as Xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { wsAuthQuery } from '../api.ts';
import {
  Terminal as TerminalIcon,
  Play,
  AlertCircle,
  Trash2,
  ShieldCheck,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Minus,
  Square,
  ChevronUp,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTheme, xtermThemeFromConfig } from '../theme.tsx';
import { useToast } from './Toast.tsx';

export interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system' | 'request';
  text: string;
  commandId?: string;
}

export interface TerminalPaneMeta {
  id: string;
  title: string;
}

export interface TerminalTabMeta {
  id: string;
  name: string;
  panes: TerminalPaneMeta[];
  activePaneId: string;
}

export interface TerminalLayout {
  tabs: TerminalTabMeta[];
  activeTabId: string;
}

interface PaneControl {
  /** Close the WS on purpose (inactivity) without triggering reconnect. */
  disconnect: () => void;
  /** Re-open the WS (tab activated again). No-op if already open/connecting. */
  reconnect: () => void;
  /** Ask the server to kill the PTY, then close the WS. */
  destroy: () => void;
}

interface XtermPaneProps {
  pane: TerminalPaneMeta;
  preload: string;
  replay: boolean;
  onConnectionChange: (paneId: string, connected: boolean) => void;
  registerClear: (paneId: string, fn: (() => void) | null) => void;
  registerFit: (paneId: string, fn: (() => void) | null) => void;
  registerControl: (paneId: string, control: PaneControl | null) => void;
}

const BOOT_MESSAGE =
  '\x1b[90mInteractive Core Shell initialized (PTY mode).\x1b[0m\r\n' +
  '\x1b[90mCLI AI engines available: tell-ai, codex, opencode.\x1b[0m\r\n';

const MAX_RECONNECT_ATTEMPTS = 3;

function XtermPane({
  pane,
  preload,
  replay,
  onConnectionChange,
  registerClear,
  registerFit,
  registerControl,
}: XtermPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Xterm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const disposedRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const retryAttemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstConnectRef = useRef(true);
  const { config } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    disposedRef.current = false;
    intentionalCloseRef.current = false;
    retryAttemptsRef.current = 0;
    firstConnectRef.current = true;

    const term = new Xterm({
      cursorBlink: true,
      fontSize: Math.round(12 * config.scale),
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
      scrollback: 5000,
      allowProposedApi: true,
      theme: xtermThemeFromConfig(config),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    if (preload) term.write(preload);

    const sendResize = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }),
        );
      }
    };

    const connect = () => {
      if (disposedRef.current) return;
      // Drop any previous socket silently (no reconnect cascade)
      const old = wsRef.current;
      if (old) {
        old.onopen = null;
        old.onmessage = null;
        old.onclose = null;
        old.onerror = null;
        try {
          old.close();
        } catch {
          /* ignore */
        }
      }
      intentionalCloseRef.current = false;

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // Replay server scrollback on reconnects so the gap while offline is filled
      const useReplay = firstConnectRef.current ? replay : true;
      const wsUrl = `${proto}://${window.location.host}/api/terminal?paneId=${encodeURIComponent(
        pane.id,
      )}&cols=${term.cols}&rows=${term.rows}&scrollback=${useReplay ? '1' : '0'}${wsAuthQuery()}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      firstConnectRef.current = false;

      ws.onopen = () => {
        retryAttemptsRef.current = 0;
        onConnectionChange(pane.id, true);
        sendResize();
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'data') term.write(msg.data);
          else if (msg.type === 'exit') {
            term.write(`\r\n\x1b[90m[process exited with code ${msg.code}]\x1b[0m\r\n`);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        onConnectionChange(pane.id, false);
        if (disposedRef.current || intentionalCloseRef.current) return;
        // Reconnect with backoff: 1s, 2s, 3s
        if (retryAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          retryAttemptsRef.current += 1;
          retryTimerRef.current = setTimeout(connect, 1000 * retryAttemptsRef.current);
        } else {
          toast('error', `Terminal disconnected (pane "${pane.title}") — reconnection failed. Switch tabs to retry.`);
        }
      };
      ws.onerror = () => {
        /* onclose always follows an error */
      };
    };

    const inputDisposable = term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });
    const resizeDisposable = term.onResize(() => sendResize());

    connect();

    registerClear(pane.id, () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: '\x0c' }));
      }
      term.clear();
    });

    registerFit(pane.id, () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      }
    });

    registerControl(pane.id, {
      disconnect: () => {
        intentionalCloseRef.current = true;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        try {
          wsRef.current?.close();
        } catch {
          /* ignore */
        }
      },
      reconnect: () => {
        if (disposedRef.current) return;
        const ws = wsRef.current;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
        retryAttemptsRef.current = 0;
        connect();
      },
      destroy: () => {
        intentionalCloseRef.current = true;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        try {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'destroy' }));
          }
        } catch {
          /* ignore */
        }
        try {
          wsRef.current?.close();
        } catch {
          /* ignore */
        }
      },
    });

    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      }
    });
    observer.observe(el);
    observerRef.current = observer;

    return () => {
      disposedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      observer.disconnect();
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      wsRef.current = null;
      inputDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      observerRef.current = null;
      registerClear(pane.id, null);
      registerFit(pane.id, null);
      registerControl(pane.id, null);
    };
    // preload/replay are mount-time only; the register/onConnectionChange callbacks are stable
    // and the xterm theme is updated by a dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.id]);

  // Update the xterm color theme / font size live when the user changes appearance prefs
  useEffect(() => {
    try {
      if (termRef.current) {
        termRef.current.options.theme = xtermThemeFromConfig(config);
        const nextSize = Math.round(12 * config.scale);
        if (termRef.current.options.fontSize !== nextSize) {
          termRef.current.options.fontSize = nextSize;
          try {
            fitRef.current?.fit();
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      console.error('[terminal] failed to update xterm theme:', err);
    }
  }, [config]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

interface TerminalProps {
  pendingCommand: string | null;
  onConfirmPending: (editedCommand: string) => void;
  onSkipPending: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onHide?: () => void;
  agentLines?: TerminalLine[];
  onAgentLinesClear?: () => void;
  initialLayout?: TerminalLayout;
  initialScrollback?: Record<string, string>;
  onLayoutChange?: (layout: TerminalLayout) => void;
  cwd?: string;
}

const DEFAULT_TAB: TerminalTabMeta = {
  id: 'tab-1',
  name: '1: dev-shell',
  panes: [{ id: 'pane-1', title: 'bash #1' }],
  activePaneId: 'pane-1',
};

// Close WS connections of inactive tabs after this long without use (PTY survives server-side)
const TAB_WS_IDLE_MS = 60_000;

// Maximum parallel sessions (tabs). Multi-pane split was removed; one session = one tab.
export const MAX_TABS = 8;

export default function Terminal({
  pendingCommand,
  onConfirmPending,
  onSkipPending,
  isExpanded = false,
  onToggleExpand,
  onHide,
  agentLines = [],
  onAgentLinesClear,
  initialLayout,
  initialScrollback = {},
  onLayoutChange,
  cwd,
}: TerminalProps) {
  const [tabs, setTabs] = useState<TerminalTabMeta[]>([DEFAULT_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [agentFeedOpen, setAgentFeedOpen] = useState(false);
  const [paneConn, setPaneConn] = useState<Record<string, boolean>>({});

  const adoptedInitialRef = useRef(false);
  const clearFnsRef = useRef(new Map<string, () => void>());
  const fitFnsRef = useRef(new Map<string, () => void>());
  const controlFnsRef = useRef(new Map<string, PaneControl>());

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? DEFAULT_TAB;

  // Stable registration callbacks (avoid re-mounting xterm panes)
  const registerClear = useCallback((paneId: string, fn: (() => void) | null) => {
    if (fn) clearFnsRef.current.set(paneId, fn);
    else clearFnsRef.current.delete(paneId);
  }, []);

  const registerFit = useCallback((paneId: string, fn: (() => void) | null) => {
    if (fn) fitFnsRef.current.set(paneId, fn);
    else fitFnsRef.current.delete(paneId);
  }, []);

  const registerControl = useCallback((paneId: string, control: PaneControl | null) => {
    if (control) controlFnsRef.current.set(paneId, control);
    else controlFnsRef.current.delete(paneId);
  }, []);

  const handleConnectionChange = useCallback((paneId: string, connected: boolean) => {
    setPaneConn((prev) => (prev[paneId] === connected ? prev : { ...prev, [paneId]: connected }));
  }, []);

  // Auto-open the Agent Feed when something needs attention:
  // a pending command authorization or a freshly arrived error line.
  const lastErrorCountRef = useRef(0);
  useEffect(() => {
    const errors = agentLines.filter((l) => l.type === 'error').length;
    if (errors > lastErrorCountRef.current) setAgentFeedOpen(true);
    lastErrorCountRef.current = errors;
  }, [agentLines]);

  useEffect(() => {
    if (pendingCommand) setAgentFeedOpen(true);
  }, [pendingCommand]);

  // Adopt a restored session layout when it arrives. Merge by id so it works
  // even if the user already touched the layout (added tabs/panes) before the
  // session fetch resolved; an untouched default tab is replaced outright.
  useEffect(() => {
    if (!initialLayout || !initialLayout.tabs.length || adoptedInitialRef.current) return;
    adoptedInitialRef.current = true;
    setTabs((prev) => {
      const isVirgin =
        prev.length === 1 &&
        prev[0]?.id === DEFAULT_TAB.id &&
        prev[0]?.panes.length === 1 &&
        prev[0]?.panes[0]?.id === DEFAULT_TAB.panes[0]?.id;
      if (isVirgin) return initialLayout.tabs;

      const restoredIds = new Set(initialLayout.tabs.map((t) => t.id));
      const merged = initialLayout.tabs.map((rt) => {
        const existing = prev.find((t) => t.id === rt.id);
        if (!existing) return rt;
        const restoredPaneIds = new Set(rt.panes.map((p) => p.id));
        const userOnlyPanes = existing.panes.filter((p) => !restoredPaneIds.has(p.id));
        return { ...rt, panes: [...rt.panes, ...userOnlyPanes] };
      });
      const userOnlyTabs = prev.filter((t) => !restoredIds.has(t.id));
      return [...merged, ...userOnlyTabs];
    });
    setActiveTabId(initialLayout.activeTabId || initialLayout.tabs[0]?.id || 'tab-1');
  }, [initialLayout]);

  // Notify parent about layout changes (for session persistence)
  useEffect(() => {
    onLayoutChange?.({ tabs, activeTabId });
  }, [tabs, activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect panes of the active tab; close WS of inactive tabs after a 60s idle
  // (server keeps the PTY alive for 5min without clients, so this saves resources
  // without losing shells).
  useEffect(() => {
    const idlePanes: string[] = [];
    for (const tab of tabs) {
      for (const pane of tab.panes) {
        if (tab.id === activeTabId) {
          controlFnsRef.current.get(pane.id)?.reconnect();
        } else {
          idlePanes.push(pane.id);
        }
      }
    }
    const timer = setTimeout(() => {
      for (const id of idlePanes) controlFnsRef.current.get(id)?.disconnect();
    }, TAB_WS_IDLE_MS);
    return () => clearTimeout(timer);
  }, [activeTabId, tabs]);

  // Global keyboard shortcuts for the pending authorization overlay
  useEffect(() => {
    if (!pendingCommand) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inChatInput =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        !String(target.className).includes('xterm-helper-textarea');
      if (inChatInput) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkipPending();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onConfirmPending(pendingCommand);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingCommand, onSkipPending, onConfirmPending]);

  const updateTab = (updater: (tab: TerminalTabMeta) => TerminalTabMeta) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)),
    );
  };

  const nextTabNumber = (list: TerminalTabMeta[]): number =>
    list.reduce((max, t) => Math.max(max, parseInt(t.name, 10) || 0), 0) + 1;

  const handleAddTab = () => {
    if (tabs.length >= MAX_TABS) return;
    const newTabNum = nextTabNumber(tabs);
    const newPaneId = crypto.randomUUID();
    const newTabId = crypto.randomUUID();
    const newTab: TerminalTabMeta = {
      id: newTabId,
      name: `${newTabNum}: session-${newTabNum}`,
      panes: [{ id: newPaneId, title: `bash #${newTabNum}` }],
      activePaneId: newPaneId,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const destroyPanes = (paneIds: string[]) => {
    for (const id of paneIds) controlFnsRef.current.get(id)?.destroy();
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const target = tabs.find((t) => t.id === tabId);
    if (target) destroyPanes(target.panes.map((p) => p.id));
    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[0]?.id ?? 'tab-1');
    }
  };

  const handleClosePane = (paneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab.panes.length <= 1) return;
    destroyPanes([paneId]);
    const remaining = activeTab.panes.filter((p) => p.id !== paneId);
    const newActive = activeTab.activePaneId === paneId ? (remaining[0]?.id ?? activeTab.activePaneId) : activeTab.activePaneId;
    updateTab((tab) => ({ ...tab, panes: remaining, activePaneId: newActive }));
  };

  const handleSelectPane = (paneId: string) => {
    updateTab((tab) => ({ ...tab, activePaneId: paneId }));
  };

  // Refit every pane of the newly active tab (they were hidden -> 0-size while inactive)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const tab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
      if (!tab) return;
      for (const pane of tab.panes) {
        fitFnsRef.current.get(pane.id)?.();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearPane = (paneId: string) => {
    clearFnsRef.current.get(paneId)?.();
  };

  const handleStartRenameTab = (tab: TerminalTabMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTabId(tab.id);
    setRenamingName(tab.name);
  };

  const handleSaveTabName = (tabId: string) => {
    if (renamingName.trim()) {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name: renamingName.trim() } : t)));
    }
    setRenamingTabId(null);
  };

  const getGridClasses = (count: number) => {
    switch (count) {
      case 1:
        return 'grid-cols-1 grid-rows-1';
      case 2:
        return 'grid-cols-1 md:grid-cols-2 grid-rows-1';
      case 3:
        return 'grid-cols-1 md:grid-cols-2 grid-rows-2';
      default:
        return 'grid-cols-2 grid-rows-2';
    }
  };

  const totalPanes = tabs.reduce((n, t) => n + t.panes.length, 0);
  const onlinePanes = Object.values(paneConn).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary) text-(--color-text-primary) font-mono text-[11px] leading-relaxed select-text overflow-hidden relative">
      {/* Agent Feed (AI activity) */}
      {agentLines.length > 0 && (
        <div className="shrink-0 border-b border-(--color-accent)/20 bg-(--color-bg-primary)">
          <div className="flex items-center justify-between px-3 py-1 select-none">
            <button
              onClick={() => setAgentFeedOpen(!agentFeedOpen)}
              className="flex items-center gap-1.5 text-[9px] font-display font-black uppercase tracking-widest text-(--color-accent) cursor-pointer"
            >
              {agentFeedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              <SparkleIcon />
              <span>Agent Feed ({agentLines.length})</span>
            </button>
            {onAgentLinesClear && (
              <button
                onClick={onAgentLinesClear}
                className="text-(--color-text-muted) hover:text-(--color-accent-text) text-[9px] uppercase tracking-widest cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          {agentFeedOpen && (
            <div className="px-3 pb-2 space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
              {agentLines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all text-[9.5px]">
                  {line.type === 'input' && (
                    <div className="text-(--color-text-primary) font-semibold">
                      <span className="text-(--color-accent) font-black">$ </span>
                      {line.text}
                    </div>
                  )}
                  {line.type === 'output' && <div className="text-(--color-text-secondary)">{line.text}</div>}
                  {line.type === 'error' && (
                    <div className="text-(--color-error) font-bold uppercase tracking-wide">{line.text}</div>
                  )}
                  {line.type === 'system' && (
                    <div className="text-(--color-text-muted) italic font-sans">[ {line.text} ]</div>
                  )}
                  {line.type === 'request' && (
                    <div className="text-(--color-accent-text) border border-(--color-accent)/20 bg-(--color-accent-subtle) p-1 font-sans text-[9.5px]">
                      {line.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Header & Tabs Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-(--color-bg-tertiary) border-b border-(--color-border-subtle) shrink-0 select-none">
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pr-2">
          <div className="flex items-center gap-1.5 font-display font-black text-[10px] tracking-widest uppercase text-(--color-text-secondary) shrink-0 pr-1 select-none">
            <TerminalIcon className="w-3.5 h-3.5 text-(--color-accent) animate-pulse" />
            <span className="inline font-bold text-(--color-text-secondary)">Terminal</span>
            {isExpanded && (
              <span className="text-(--color-text-secondary) bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
                Maximized
              </span>
            )}
            <span className="text-(--color-accent-text) font-mono text-[9px] bg-(--color-accent-subtle) border border-(--color-accent)/30 px-1.5 py-0.5 ml-0.5 font-semibold">
              PTY
            </span>
          </div>

          <div role="tablist" aria-label="Terminal sessions" className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isRenaming = renamingTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  data-tab-id={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onDoubleClick={(e) => handleStartRenameTab(tab, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      e.stopPropagation();
                      const idx = tabs.findIndex((t) => t.id === tab.id);
                      const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
                      const nextTab = tabs[next];
                      if (!nextTab) return;
                      setActiveTabId(nextTab.id);
                      requestAnimationFrame(() => {
                        document.querySelector<HTMLElement>(`[data-tab-id="${nextTab.id}"]`)?.focus();
                      });
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[10px] border font-mono transition-all cursor-pointer ${
                    isActive
                      ? 'bg-(--color-bg-elevated) border-(--color-accent)/60 text-(--color-text-primary) font-bold shadow-sm'
                      : 'bg-white/5 border-(--color-border-subtle) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10'
                  }`}
                >
                  <Square className={`w-2.5 h-2.5 ${isActive ? 'fill-(--color-accent) text-(--color-accent)' : 'text-(--color-text-muted)'}`} />
                  {isRenaming ? (
                    <input
                      type="text"
                      value={renamingName}
                      onChange={(e) => setRenamingName(e.target.value)}
                      onBlur={() => handleSaveTabName(tab.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTabName(tab.id)}
                      autoFocus
                      className="bg-(--color-bg-primary) text-(--color-text-primary) px-1 py-0.5 border border-(--color-accent) text-[10px] w-20 focus:outline-none"
                    />
                  ) : (
                    <span className="truncate max-w-[100px]">{tab.name}</span>
                  )}
                  <span className="text-[9px] text-(--color-text-muted) font-sans ml-0.5">({tab.panes.length}P)</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      className="p-0.5 hover:bg-white/10 text-(--color-text-muted) hover:text-(--color-accent-text) transition-colors ml-1"
                      title="Close Tab"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleAddTab}
              disabled={tabs.length >= MAX_TABS}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] border font-mono transition-all ${
                tabs.length >= MAX_TABS
                  ? 'border-(--color-border-subtle) text-(--color-text-muted) cursor-not-allowed opacity-50'
                  : 'border-(--color-border-medium) bg-white/5 text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10 hover:border-(--color-border-strong) cursor-pointer'
              }`}
              title={tabs.length >= MAX_TABS ? `Maximum ${MAX_TABS} parallel tabs reached` : `Add new parallel tab (Max ${MAX_TABS})`}
            >
              <Plus className="w-3 h-3 text-(--color-accent)" />
              <span className="hidden sm:inline">New Tab</span>
              <span className="text-[9px] text-(--color-text-muted)">({tabs.length}/{MAX_TABS})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCommand && (
            <span className="hidden sm:flex items-center gap-1.5 text-[9px] bg-(--color-error)/15 text-(--color-error) border border-(--color-error)/40 px-2 py-0.5 font-black uppercase tracking-wider animate-pulse">
              <AlertCircle className="w-3 h-3" />
              Auth required · Esc skip · Ctrl+↵ run
            </span>
          )}

          <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-(--color-border-subtle) p-0.5">
            <span className="hidden md:inline px-2 py-0.5 text-[10px] text-(--color-text-muted) uppercase font-bold tracking-wider select-none">
              1 sessão = 1 tab
            </span>
          </div>

          <span className="hidden md:flex items-center gap-1.5 text-[9px] bg-white/5 text-(--color-text-secondary) border border-(--color-border-medium) px-2 py-0.5 uppercase font-bold tracking-wider">
            <ShieldCheck className="w-3 h-3 text-(--color-accent)" /> Sandbox
          </span>

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors cursor-pointer"
              title={isExpanded ? 'Restore Shell Height' : 'Maximize Shell Height'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onHide && !isExpanded && (
            <button
              onClick={onHide}
              className="p-1 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors cursor-pointer"
              title="Minimizar console (esconder)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => handleClearPane(activeTab.activePaneId)}
            className="p-1 hover:bg-white/10 text-(--color-text-muted) hover:text-(--color-accent-text) transition-colors cursor-pointer"
            title="Clear Active Pane Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Panes Grid Container — all tabs stay mounted; inactive ones are hidden */}
      <div className="relative flex-1 p-1.5 bg-(--color-bg-tertiary) overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 grid gap-1.5 ${tab.id === activeTabId ? '' : 'hidden'} ${getGridClasses(tab.panes.length)}`}
          >
            {tab.panes.map((pane) => {
          const isFocused = pane.id === activeTab.activePaneId;
          const preloadScrollback = initialScrollback[pane.id] || '';
          const isRestored = adoptedInitialRef.current;
          const preload = isRestored ? preloadScrollback : BOOT_MESSAGE;
          const replay = isRestored ? !preloadScrollback : true;
          const paneOnline = !!paneConn[pane.id];

          return (
            <div
              key={pane.id}
              onClick={() => handleSelectPane(pane.id)}
              className={`flex flex-col h-full min-h-0 border transition-all duration-200 ${
                isFocused
                  ? 'border-(--color-accent)/80 bg-(--color-bg-elevated) shadow-lg shadow-(--color-accent)/20'
                  : 'border-(--color-border-subtle) bg-(--color-bg-tertiary) opacity-80 hover:opacity-100 hover:border-(--color-border-medium)'
              }`}
            >
              <div className="flex items-center justify-between px-2.5 py-1 bg-(--color-bg-secondary) border-b border-(--color-border-subtle) shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFocused ? 'bg-(--color-accent)' : 'bg-(--color-text-muted)'}`} />
                  <span className="font-bold text-[10px] text-(--color-text-secondary) truncate">
                    {pane.title || 'bash'}
                  </span>
                  <span
                    title={paneOnline ? 'PTY Online' : 'PTY Offline'}
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${paneOnline ? 'bg-(--color-success)' : 'bg-(--color-error)/60 animate-pulse'}`}
                  />
                  {isFocused && (
                    <span className="text-[8px] bg-(--color-accent) text-white font-black px-1 py-0.2 tracking-wider uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {activeTab.panes.length > 1 && (
                    <button
                      onClick={(e) => handleClosePane(pane.id, e)}
                      className="p-1 hover:bg-(--color-accent-subtle) hover:text-(--color-accent-text) text-(--color-text-muted) transition-colors cursor-pointer ml-1"
                      title="Close Pane"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="relative flex-1 min-h-0 bg-(--color-bg-tertiary)">
                <XtermPane
                  pane={pane}
                  preload={preload}
                  replay={replay}
                  onConnectionChange={handleConnectionChange}
                  registerClear={registerClear}
                  registerFit={registerFit}
                  registerControl={registerControl}
                />

                {/* Pending Command Authorization Prompt inside Pane */}
                {pendingCommand && isFocused && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-3">
                    <div className="border border-(--color-accent)/40 bg-(--color-bg-primary)/95 p-3 w-full space-y-2 text-(--color-text-primary) shadow-2xl">
                      <div className="flex items-center gap-1.5 text-(--color-accent) font-black text-xs uppercase tracking-wider select-none font-display">
                        <AlertCircle className="w-3.5 h-3.5 text-(--color-accent) shrink-0" />
                        <span>Permission Requested: Shell Execution</span>
                      </div>
                      <p className="text-[10px] text-(--color-text-secondary) font-sans select-none">
                        The AI requested to execute this script in workspace:
                      </p>
                      <pre className="p-2 bg-(--color-bg-tertiary) border border-(--color-border-subtle) text-(--color-accent-text) font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                        {pendingCommand}
                      </pre>
                      <div className="flex items-center justify-end gap-2 pt-1 select-none">
                        <button
                          onClick={onSkipPending}
                          className="px-3 py-1 border border-(--color-border-medium) hover:bg-white/10 text-(--color-text-secondary) font-sans text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => onConfirmPending(pendingCommand)}
                          className="flex items-center gap-1 px-4 py-1 bg-(--color-text-primary) hover:bg-(--color-accent) text-(--color-bg-primary) hover:text-white font-sans text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Authorize & Execute
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
            })}
          </div>
        ))}
      </div>

      {/* Classic PTY Bottom Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-(--color-bg-tertiary) border-t border-(--color-border-subtle) text-[9.5px] text-(--color-text-muted) font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-(--color-accent) font-bold uppercase tracking-wider">[tell-ai:pty]</span>
          <div className="flex items-center gap-1.5 text-(--color-text-secondary)">
            {tabs.map((tab, idx) => (
              <span
                key={tab.id}
                className={tab.id === activeTabId ? 'text-(--color-accent-text) font-bold underline' : 'text-(--color-text-muted)'}
              >
                {idx + 1}:{tab.name.split(':')[1] || tab.name}
                {tab.id === activeTabId ? '*' : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span>
            Tabs: <strong className="text-(--color-text-secondary)">{tabs.length}/{MAX_TABS}</strong>
          </span>
          <span>CLI-AI Support: <strong className="text-(--color-accent-text)">tell-ai, codex, opencode</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-(--color-text-muted) max-w-[180px] truncate" title={cwd}>
            {cwd || 'CWD: /'}
          </span>
          {onlinePanes > 0 ? (
            <span className="flex items-center gap-1 text-(--color-success) font-bold" title="PTY sessions online / total panes">
              <Wifi className="w-3 h-3" /> PTY {onlinePanes}/{totalPanes}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-(--color-text-muted)">
              <WifiOff className="w-3 h-3" /> Connecting
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return <span className="text-(--color-accent)">✦</span>;
}
