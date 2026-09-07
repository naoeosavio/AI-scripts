// Pure terminal-layout helpers (no React): merge/adopt, active-tab safety,
// lateral width clamp and monotonic tab numbering. Covered by tests so the
// Agent<->Terminal view-switch reset bug cannot regress silently.

export interface TerminalPaneLike {
  id: string;
  title: string;
}

export interface TerminalTabLike {
  id: string;
  name: string;
  panes: TerminalPaneLike[];
  activePaneId: string;
}

export interface TerminalLayoutLike {
  tabs: TerminalTabLike[];
  activeTabId: string;
}

export const TERMINAL_LAYOUT_KEY = 'tell-terminal-layout-v1';
export const MAX_TABS = 8;
export const TERMINAL_WIDTH_CH_MIN = 60;
export const TERMINAL_WIDTH_CH_MAX = 200;
export const TERMINAL_WIDTH_CH_DEFAULT = 80;

export function clampTerminalWidthCh(value: unknown): number {
  const n = typeof value === 'number' && !Number.isNaN(value) ? Math.round(value) : TERMINAL_WIDTH_CH_DEFAULT;
  return Math.min(Math.max(n, TERMINAL_WIDTH_CH_MIN), TERMINAL_WIDTH_CH_MAX);
}


/** First tab id wins when the requested active id is gone (stale after close/race). */
export function resolveSafeActiveTabId(tabs: TerminalTabLike[], activeTabId: string): string {
  if (tabs.some((t) => t.id === activeTabId)) return activeTabId;
  return tabs[0]?.id ?? activeTabId;
}

/** Highest numeric `N:` prefix in tab names (rename-safe: non-numeric names count 0). */
export function maxTabNumber(tabs: TerminalTabLike[]): number {
  return tabs.reduce((max, t) => Math.max(max, parseInt(t.name, 10) || 0), 0);
}

/** Next tab number given a monotonic sequence counter (never reuses after rename). */
export function nextTabNumber(seq: number, tabs: TerminalTabLike[]): { seq: number; num: number } {
  const next = Math.max(seq, maxTabNumber(tabs), tabs.length) + 1;
  return { seq: next, num: next };
}

function isVirginDefaultTab(tabs: TerminalTabLike[]): boolean {
  return (
    tabs.length === 1 &&
    tabs[0]?.id === 'tab-1' &&
    tabs[0]?.panes.length === 1 &&
    tabs[0]?.panes[0]?.id === 'pane-1'
  );
}

/**
 * Merge a server-restored layout with locally touched tabs.
 * - Virgin default tab is replaced outright (fresh start).
 * - Otherwise restored tabs win by id, user-only tabs are appended
 *   (renames/new tabs made before the fetch resolved survive).
 */
export function mergeRestoredTerminalLayout(
  prev: TerminalTabLike[],
  restored: TerminalLayoutLike,
): TerminalTabLike[] {
  if (!restored.tabs.length) return prev;
  if (isVirginDefaultTab(prev)) return restored.tabs;
  const restoredIds = new Set(restored.tabs.map((t) => t.id));
  const merged = restored.tabs.map((rt) => {
    const existing = prev.find((t) => t.id === rt.id);
    if (!existing) return rt;
    // Local rename wins over the stale server snapshot.
    return existing;
  });
  const userOnlyTabs = prev.filter((t) => !restoredIds.has(t.id));
  return [...merged, ...userOnlyTabs];
}

/** Parse a persisted layout blob (localStorage / session.json terminal field). */
export function parsePersistedTerminalLayout(raw: unknown): TerminalLayoutLike | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tabs) || obj.tabs.length === 0) return null;
  const tabs = (obj.tabs as unknown[]).filter(
    (t): t is TerminalTabLike =>
      !!t && typeof t === 'object' && typeof (t as TerminalTabLike).id === 'string',
  );
  if (tabs.length === 0) return null;
  return {
    tabs,
    activeTabId: typeof obj.activeTabId === 'string' ? (obj.activeTabId as string) : (tabs[0]?.id ?? ''),
  };
}
