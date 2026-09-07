import http from 'node:http';
import { spawn, IPty } from 'node-pty';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { isValidPaneId, clampTerminalSize } from './guards';

const MAX_SCROLLBACK_CHARS = 50 * 1024;
const GC_AFTER_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 12;

export interface TerminalServerOptions {
  cwd: string;
  shell?: string;
  /** When set, WS upgrades must carry ?token=<value> (mirrors TELL_TOKEN auth). */
  token?: string;
}

interface PaneSession {
  paneId: string;
  pty: IPty;
  clients: Set<WebSocket>;
  scrollback: string[];
  scrollbackChars: number;
  lastDisconnect: number | null;
  timer: NodeJS.Timeout | null;
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

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname, searchParams } = new URL(req.url || '/', `http://${req.headers.host}`);

    // Leave Vite's HMR socket alone in dev; destroy anything else off-path so
    // unmatched upgrades never hang the client.
    if (pathname !== '/api/terminal') {
      const protocol = req.headers['sec-websocket-protocol'] || '';
      if (!String(protocol).includes('vite-hmr')) socket.destroy();
      return;
    }

    // Origin check: same host only (anti cross-site WS hijacking)
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }

    // Bearer token parity with the REST API
    if (opts.token && searchParams.get('token') !== opts.token) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const { searchParams } = new URL(req.url || '/', `http://${req.headers.host}`);

    const rawPaneId = searchParams.get('paneId') || `pane-${Math.random().toString(36).slice(2)}`;
    if (!isValidPaneId(rawPaneId)) {
      ws.close(4400, 'invalid paneId');
      return;
    }
    const paneId = rawPaneId;

    const size = clampTerminalSize(
      Number(searchParams.get('cols')) || 80,
      Number(searchParams.get('rows')) || 24,
    );

    if (!sessions.has(paneId) && sessions.size >= MAX_SESSIONS) {
      ws.close(4429, 'too many terminal sessions');
      return;
    }

    const session = ensureSession(paneId, opts);
    const replay = searchParams.get('scrollback') !== '0';
    attachClient(session, ws, replay);

    try {
      session.pty.resize(size.cols, size.rows);
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
        if (msg.data.length > 4096) return;
        session.pty.write(msg.data);
      } else if (msg.type === 'resize' && Number.isFinite(msg.cols) && Number.isFinite(msg.rows)) {
        const clamped = clampTerminalSize(msg.cols, msg.rows);
        try {
          session.pty.resize(clamped.cols, clamped.rows);
        } catch {
          /* ignore */
        }
      } else if (msg.type === 'destroy') {
        // Client closed the pane/tab on purpose: kill the PTY immediately
        // instead of waiting for the 5min GC.
        if (session.timer) clearTimeout(session.timer);
        sessions.delete(session.paneId);
        for (const client of session.clients) {
          if (client !== ws && client.readyState === client.OPEN) {
            client.close(4404, 'pane destroyed');
          }
        }
        session.clients.clear();
        try {
          session.pty.kill();
        } catch {
          /* already dead */
        }
        try {
          ws.close(4404, 'pane destroyed');
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
