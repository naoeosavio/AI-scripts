import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TerminalPaneState {
  id: string;
  title: string;
  scrollback: string;
}

export interface TerminalTabState {
  id: string;
  name: string;
  panes: TerminalPaneState[];
  activePaneId: string;
}

export interface TellSession {
  version: number;
  project: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  systemPrompt: string;
  generatedContextHash: string;
  messages: Array<{ role: string; content: string; thought?: string | null }>;
  terminal: { tabs: TerminalTabState[]; activeTabId: string };
  keysUsed: string[];
  filesChanged: string[];
  stats: { commandsRun: number; aiTurns: number; snapshots: number };
}

export function sessionDir(cwd: string): string {
  return path.join(cwd, '.tell');
}

export function sessionPath(cwd: string): string {
  return path.join(sessionDir(cwd), 'session.json');
}

export function historyDir(cwd: string): string {
  return path.join(sessionDir(cwd), 'history');
}

export function emptySession(cwd: string): TellSession {
  return {
    version: 1,
    project: path.basename(cwd) || cwd,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: '',
    systemPrompt: '',
    generatedContextHash: '',
    messages: [],
    terminal: { tabs: [], activeTabId: '' },
    keysUsed: [],
    filesChanged: [],
    stats: { commandsRun: 0, aiTurns: 0, snapshots: 0 },
  };
}

const MAX_SESSION_BYTES = 2 * 1024 * 1024;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Coerce a partially-corrupted session object into a valid TellSession. */
function sanitizeSession(cwd: string, raw: unknown): TellSession {
  const base = emptySession(cwd);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const obj = raw as Record<string, any>;
  const terminal =
    obj.terminal && typeof obj.terminal === 'object' && !Array.isArray(obj.terminal)
      ? {
          tabs: asArray<TerminalTabState>(obj.terminal.tabs).filter(
            (t) => t && typeof t === 'object' && typeof t.id === 'string',
          ),
          activeTabId: typeof obj.terminal.activeTabId === 'string' ? obj.terminal.activeTabId : '',
        }
      : base.terminal;
  const stats =
    obj.stats && typeof obj.stats === 'object' && !Array.isArray(obj.stats)
      ? {
          commandsRun: Number(obj.stats.commandsRun) || 0,
          aiTurns: Number(obj.stats.aiTurns) || 0,
          snapshots: Number(obj.stats.snapshots) || 0,
        }
      : base.stats;
  return {
    ...base,
    ...obj,
    version: Number(obj.version) || base.version,
    messages: asArray<{ role: string; content: string; thought?: string | null }>(obj.messages).filter(
      (m) => m && typeof m === 'object' && typeof m.role === 'string',
    ),
    keysUsed: asArray<string>(obj.keysUsed).filter((k) => typeof k === 'string'),
    filesChanged: asArray<string>(obj.filesChanged).filter((f) => typeof f === 'string'),
    terminal,
    stats,
  };
}

export function loadSession(cwd: string): TellSession | null {
  const file = sessionPath(cwd);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return sanitizeSession(cwd, raw);
  } catch {
    return null;
  }
}

/** Check serialized size before writing to disk. Returns null when oversized. */
function serializeBounded(session: TellSession, label: string): string | null {
  const json = JSON.stringify(session, null, 2);
  if (Buffer.byteLength(json, 'utf8') > MAX_SESSION_BYTES) {
    console.warn(`[tell] ${label} rejected: exceeds ${MAX_SESSION_BYTES} bytes`);
    return null;
  }
  return json;
}

export function saveSession(cwd: string, session: TellSession): boolean {
  try {
    session.updatedAt = new Date().toISOString();
    const json = serializeBounded(session, 'saveSession');
    if (!json) return false;
    fs.mkdirSync(sessionDir(cwd), { recursive: true });
    const tmp = `${sessionPath(cwd)}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, sessionPath(cwd));
    return true;
  } catch {
    return false;
  }
}

export function listHistory(cwd: string): Array<{ name: string; createdAt: string; size: number }> {
  repairLatestSymlink(cwd);
  const dir = historyDir(cwd);
  if (!fs.existsSync(dir)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.json'))
    .map((name) => {
      const full = path.join(dir, name);
      let stat: fs.Stats | undefined;
      try {
        stat = fs.statSync(full);
      } catch {
        return null;
      }
      return { name, createdAt: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs, size: stat.size };
    })
    .filter((x): x is { name: string; createdAt: string; mtimeMs: number; size: number } => x !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map(({ name, createdAt, size }) => ({ name, createdAt, size }));
}

export function createSnapshot(cwd: string, session: TellSession): string | null {
  try {
    session.stats.snapshots = (session.stats.snapshots || 0) + 1;
    session.updatedAt = new Date().toISOString();
    const json = serializeBounded(session, 'createSnapshot');
    if (!json) return null;
    fs.mkdirSync(historyDir(cwd), { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const full = path.join(historyDir(cwd), name);
    fs.writeFileSync(full, json, 'utf8');
    updateLatestSymlink(cwd, name);
    return name;
  } catch {
    return null;
  }
}

function updateLatestSymlink(cwd: string, snapshotName: string): void {
  const latest = path.join(sessionDir(cwd), 'latest');
  try {
    fs.unlinkSync(latest);
  } catch {
    /* not present */
  }
  try {
    fs.symlinkSync(path.join('history', snapshotName), latest);
  } catch {
    /* best-effort */
  }
}

/** Drop a dangling `latest` symlink; ignore if missing or valid. */
export function repairLatestSymlink(cwd: string): void {
  const latest = path.join(sessionDir(cwd), 'latest');
  let isSymlink = false;
  try {
    isSymlink = fs.lstatSync(latest).isSymbolicLink();
  } catch {
    return; // not present
  }
  if (!isSymlink) return;
  try {
    const target = fs.readlinkSync(latest);
    fs.accessSync(path.resolve(sessionDir(cwd), target));
  } catch {
    try {
      fs.unlinkSync(latest);
      console.warn('[tell] dangling `latest` symlink removed');
    } catch {
      /* best-effort */
    }
  }
}

export async function listGitChanges(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd, timeout: 5000 });
    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
