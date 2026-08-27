import http from 'node:http';
import { spawn, IPty } from 'node-pty';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

const MAX_SCROLLBACK_CHARS = 50 * 1024;
const GC_AFTER_MS = 5 * 60 * 1000;

interface PaneSession {
  paneId: string;
  pty: IPty;
  clients: Set<WebSocket>;
  scrollback: string[];
  scrollbackChars: number;
  lastDisconnect: number | null;
  timer: NodeJS.Timeout | null;
}

export interface TerminalServerOptions {
  cwd: string;
  shell?: string;
}

const sessions = new Map<string, PaneSession>();

function pushScrollback(session: PaneSession, data: string): void {
  session.scrollback.push(data);
  session.scrollbackChars += data.length;
  while (session.scrollbackChars > MAX_SCROLLBACK_CHARS && session.scrollback.length > 0) {
    const dropped = session.scrollback.shift();
    if (dropped) session.scrollbackChars -= dropped.length;
  }
}

export function getScrollback(paneId: string): string {
  const session = sessions.get(paneId);
  if (!session) return '';
  return session.scrollback.join('');
}

export function activePaneIds(): string[] {
  return [...sessions.keys()];
}

function scheduleGc(paneId: string, session: PaneSession): void {
  if (session.clients.size > 0) return;
  if (session.timer) clearTimeout(session.timer);
  session.lastDisconnect = Date.now();
  session.timer = setTimeout(() => {
    const s = sessions.get(paneId);
    if (s && s.clients.size === 0) {
      try {
        s.pty.kill();
      } catch {
        /* already dead */
      }
      sessions.delete(paneId);
    }
  }, GC_AFTER_MS);
}

function ensureSession(paneId: string, opts: TerminalServerOptions): PaneSession {
  let session = sessions.get(paneId);
  if (session) return session;

  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  };
  const pty = spawn(opts.shell || '/bin/bash', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: opts.cwd,
    env,
  });

  session = {
    paneId,
    pty,
    clients: new Set(),
    scrollback: [],
    scrollbackChars: 0,
    lastDisconnect: null,
    timer: null,
  };
  sessions.set(paneId, session);

  pty.onData((data) => {
    pushScrollback(session, data);
    for (const client of session.clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: 'data', data }));
      }
    }
  });
  pty.onExit(({ exitCode }) => {
    const payload = JSON.stringify({ type: 'exit', code: exitCode });
    for (const client of session.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  });

  return session;
}

function attachClient(session: PaneSession, ws: WebSocket, replay: boolean): void {
  session.clients.add(ws);
  if (replay) ws.send(JSON.stringify({ type: 'data', data: session.scrollback.join('') }));
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }
  session.lastDisconnect = null;
}

function detachClient(session: PaneSession, ws: WebSocket): void {
  session.clients.delete(ws);
  scheduleGc(session.paneId, session);
}

export function attachTerminalServer(server: http.Server, opts: TerminalServerOptions): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url || '/', `http://${req.headers.host}`);
    if (pathname !== '/api/terminal') return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const { searchParams } = new URL(req.url || '/', `http://${req.headers.host}`);
    const paneId = searchParams.get('paneId') || `pane-${Math.random().toString(36).slice(2)}`;
    const cols = Math.max(20, Number(searchParams.get('cols')) || 80);
    const rows = Math.max(5, Number(searchParams.get('rows')) || 24);

    const session = ensureSession(paneId, opts);
    const replay = searchParams.get('scrollback') !== '0';
    attachClient(session, ws, replay);

    try {
      session.pty.resize(cols, rows);
    } catch {
      /* resize before spawn of underlying pts is fine to ignore */
    }

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!session || !session.pty) return;
      if (msg.type === 'input' && typeof msg.data === 'string') {
        session.pty.write(msg.data);
      } else if (msg.type === 'resize' && Number.isFinite(msg.cols) && Number.isFinite(msg.rows)) {
        try {
          session.pty.resize(Math.max(20, msg.cols), Math.max(5, msg.rows));
        } catch {
          /* ignore */
        }
      }
    });

    ws.on('close', () => {
      detachClient(session, ws);
    });
    ws.on('error', () => {
      detachClient(session, ws);
      ws.close();
    });
  });
}
