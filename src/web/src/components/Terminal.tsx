import React, { useEffect, useRef, useState } from 'react';
import { Terminal as Xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  Play,
  AlertCircle,
  Trash2,
  ShieldCheck,
  Columns,
  Rows,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Square,
  ChevronUp,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTheme, xtermThemeFromConfig } from '../theme.tsx';

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

interface XtermPaneProps {
  pane: TerminalPaneMeta;
  preload: string;
  replay: boolean;
  onConnectionChange: (connected: boolean) => void;
  registerClear: (paneId: string, fn: () => void) => void;
  registerFit: (paneId: string, fn: () => void) => void;
}

const BOOT_MESSAGE =
  '\x1b[90mInteractive Core Shell initialized (PTY mode).\x1b[0m\r\n' +
  '\x1b[90mCLI AI engines available: tell-ai, codex, opencode.\x1b[0m\r\n';

function XtermPane({ pane, preload, replay, onConnectionChange, registerClear, registerFit }: XtermPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Xterm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const { config } = useTheme();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const sendData = (data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    };

    const term = new Xterm({
      cursorBlink: true,
      fontSize: 12,
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

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/api/terminal?paneId=${encodeURIComponent(
      pane.id,
    )}&cols=${term.cols}&rows=${term.rows}&scrollback=${replay ? '1' : '0'}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const sendResize = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }),
        );
      }
    };

    const inputDisposable = term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });
    const resizeDisposable = term.onResize(() => sendResize());

    registerClear(pane.id, () => {
      sendData('\x0c');
      term.clear();
    });

    ws.onopen = () => {
      sendResize();
      onConnectionChange(true);
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
      onConnectionChange(false);
      inputDisposable.dispose();
      resizeDisposable.dispose();
    };

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

    registerFit(pane.id, () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      }
    });

    return () => {
      observer.disconnect();
      ws.close();
      wsRef.current = null;
      inputDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.id]);

  // Update the xterm color theme live when the user changes appearance prefs
  useEffect(() => {
    termRef.current?.setOption('theme', xtermThemeFromConfig(config));
  }, [config]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

interface TerminalProps {
  pendingCommand: string | null;
  onConfirmPending: (editedCommand: string) => void;
  onSkipPending: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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

export default function Terminal({
  pendingCommand,
  onConfirmPending,
  onSkipPending,
  isExpanded = false,
  onToggleExpand,
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
  const [connected, setConnected] = useState(false);

  const adoptedInitialRef = useRef(false);
  const clearFnsRef = useRef(new Map<string, () => void>());
  const fitFnsRef = useRef(new Map<string, () => void>());

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Adopt a restored session layout once (when it arrives after mount)
  useEffect(() => {
    if (initialLayout && !adoptedInitialRef.current && tabs.length === 1 && tabs[0].id === 'tab-1') {
      adoptedInitialRef.current = true;
      setTabs(initialLayout.tabs.length ? initialLayout.tabs : [DEFAULT_TAB]);
      setActiveTabId(initialLayout.activeTabId || initialLayout.tabs[0]?.id || 'tab-1');
    }
  }, [initialLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent about layout changes (for session persistence)
  useEffect(() => {
    onLayoutChange?.({ tabs, activeTabId });
  }, [tabs, activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTab = (updater: (tab: TerminalTabMeta) => TerminalTabMeta) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)),
    );
  };

  const handleAddTab = () => {
    if (tabs.length >= 4) return;
    const newTabNum = tabs.length + 1;
    const newPaneId = `pane-${Date.now()}`;
    const newTabId = `tab-${Date.now()}`;
    const newTab: TerminalTabMeta = {
      id: newTabId,
      name: `${newTabNum}: session-${newTabNum}`,
      panes: [{ id: newPaneId, title: `bash #${newTabNum}` }],
      activePaneId: newPaneId,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[0].id);
    }
  };

  const handleSplitPane = (splitType: 'vertical' | 'horizontal') => {
    if (activeTab.panes.length >= 4) return;
    const newPaneId = `pane-${Date.now()}`;
    const paneCount = activeTab.panes.length + 1;
    updateTab((tab) => ({
      ...tab,
      panes: [...tab.panes, { id: newPaneId, title: `bash #${paneCount}` }],
      activePaneId: newPaneId,
    }));
  };

  const handleClosePane = (paneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab.panes.length <= 1) return;
    const remaining = activeTab.panes.filter((p) => p.id !== paneId);
    const newActive = activeTab.activePaneId === paneId ? remaining[0].id : activeTab.activePaneId;
    updateTab((tab) => ({ ...tab, panes: remaining, activePaneId: newActive }));
  };

  const handleSelectPane = (paneId: string) => {
    updateTab((tab) => ({ ...tab, activePaneId: paneId }));
  };

  const registerClear = (paneId: string, fn: () => void) => {
    clearFnsRef.current.set(paneId, fn);
  };

  const registerFit = (paneId: string, fn: () => void) => {
    fitFnsRef.current.set(paneId, fn);
  };

  // Refit every pane of the newly active tab (they were hidden -> 0-size while inactive)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
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
            <span className="inline font-bold text-(--color-text-secondary)">Console Interface</span>
            {isExpanded && (
              <span className="text-(--color-text-secondary) bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
                Maximized
              </span>
            )}
            <span className="text-(--color-accent-text) font-mono text-[9px] bg-(--color-accent-subtle) border border-(--color-accent)/30 px-1.5 py-0.5 ml-0.5 font-semibold">
              TMUX
            </span>
          </div>

          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isRenaming = renamingTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onDoubleClick={(e) => handleStartRenameTab(tab, e)}
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
              disabled={tabs.length >= 4}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] border font-mono transition-all ${
                tabs.length >= 4
                  ? 'border-(--color-border-subtle) text-(--color-text-muted) cursor-not-allowed opacity-50'
                  : 'border-(--color-border-medium) bg-white/5 text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10 hover:border-(--color-border-strong) cursor-pointer'
              }`}
              title={tabs.length >= 4 ? 'Maximum 4 parallel tabs reached' : 'Add new parallel tab (Max 4)'}
            >
              <Plus className="w-3 h-3 text-(--color-accent)" />
              <span className="hidden sm:inline">New Tab</span>
              <span className="text-[9px] text-(--color-text-muted)">({tabs.length}/4)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-(--color-border-subtle) p-0.5">
            <button
              onClick={() => handleSplitPane('vertical')}
              disabled={activeTab.panes.length >= 4}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Split Pane Vertically (Side-by-side)"
            >
              <Columns className="w-3 h-3 text-(--color-accent)" />
              <span>Split V</span>
            </button>
            <button
              onClick={() => handleSplitPane('horizontal')}
              disabled={activeTab.panes.length >= 4}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Split Pane Horizontally (Stacked)"
            >
              <Rows className="w-3 h-3 text-(--color-accent)" />
              <span>Split H</span>
            </button>
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
                  onConnectionChange={(state) => {
                    if (pane.id === activeTab.activePaneId) setConnected(state);
                  }}
                  registerClear={registerClear}
                  registerFit={registerFit}
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

      {/* Classic TMUX Bottom Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-(--color-bg-tertiary) border-t border-(--color-border-subtle) text-[9.5px] text-(--color-text-muted) font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-(--color-accent) font-bold uppercase tracking-wider">[tell-ai:tmux]</span>
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
            Tabs: <strong className="text-(--color-text-secondary)">{tabs.length}/4</strong>
          </span>
          <span>
            Panes in Tab: <strong className="text-(--color-text-secondary)">{activeTab.panes.length}/4</strong>
          </span>
          <span>CLI-AI Support: <strong className="text-(--color-accent-text)">tell-ai, codex, opencode</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-(--color-text-muted) max-w-[180px] truncate" title={cwd}>
            {cwd || 'CWD: /'}
          </span>
          {connected ? (
            <span className="flex items-center gap-1 text-(--color-success) font-bold">
              <Wifi className="w-3 h-3" /> PTY Online
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
