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

export function loadSession(cwd: string): TellSession | null {
  const file = sessionPath(cwd);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...emptySession(cwd), ...raw };
  } catch {
    return null;
  }
}

export function saveSession(cwd: string, session: TellSession): boolean {
  try {
    fs.mkdirSync(sessionDir(cwd), { recursive: true });
    session.updatedAt = new Date().toISOString();
    const tmp = `${sessionPath(cwd)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf8');
    fs.renameSync(tmp, sessionPath(cwd));
    return true;
  } catch {
    return false;
  }
}

export function listHistory(cwd: string): Array<{ name: string; createdAt: string; size: number }> {
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
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        return null;
      }
      return { name, createdAt: stat.mtime.toISOString(), size: stat.size };
    })
    .filter((x): x is { name: string; createdAt: string; size: number } => x !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createSnapshot(cwd: string, session: TellSession): string | null {
  try {
    fs.mkdirSync(historyDir(cwd), { recursive: true });
    session.stats.snapshots = (session.stats.snapshots || 0) + 1;
    session.updatedAt = new Date().toISOString();
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const full = path.join(historyDir(cwd), name);
    fs.writeFileSync(full, JSON.stringify(session, null, 2), 'utf8');
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
