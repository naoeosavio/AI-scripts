# Tell Web Sandbox

The **Tell Web Sandbox** (`tell -w` / `tell --web`) turns the `tell` CLI
into a full browser-based development console. It mirrors your real shell through
pseudo-terminals (PTY), gives the AI an auto-generated system prompt built from the
project itself, and persists your session in a hidden `.tell/` folder.

You can use it to drive a project, a repository, or an entire server — right from a
browser tab, no SSH client or local terminal needed.

---

## Table of contents

- [What you get](#what-you-get)
- [Quick start (local)](#quick-start-local)
- [Where to use it](#where-to-use-it)
  - [1. Your own machine](#1-your-own-machine)
  - [2. Manage a repo from anywhere](#2-manage-a-repo-from-anywhere)
  - [3. Manage an online server](#3-manage-an-online-server)
  - [4. Via a website / hosted instance](#4-via-a-website--hosted-instance)
- [Real-world examples](#real-world-examples)
- [Session persistence (`.tell/`)](#session-persistence-tell)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## What you get

| Feature | What it does |
|---------|--------------|
| **Console Interface (real PTY)** | Each pane is a persistent interactive bash session with a real TTY. `tmux`, `vim`, `htop`, `codex`, `opencode`, `claude-code`, `tell-ai` all work as in your local shell. Up to 4 tabs / 4 panes each. |
| **AI Chat & Workspace** | General chat that manages the session: ask questions, request changes, and let the AI run commands through the `<RUN>` bridge (`/api/execute`). |
| **File Explorer & Editor** | Browse the project tree and open/edit files directly in the browser. |
| **Auto-generated system prompt** | The sandbox builds a persistent system prompt from the project: directory tree (up to 4 levels), `README.md`, and `AGENTS.md`/`agent.md` if present. |
| **Session persistence** | Auto-saved to `.tell/` (chat, model, prompt, tabs/panes, scrollback, keys used, files changed, stats) and restored on your next visit. |

---

## Quick start (local)

```bash
npm install -g tell-ai
npm install -g @tell-ai/web      # the web sandbox server (tell-web)

cd /path/to/your/project
tell --web                       # open http://localhost:3000
```

> `-w` / `--web` enables the auto-generated project context. You can run the sandbox
> in another directory with `--cwd <path>` (created with a warning if it does not
> exist) and pre-seed the first chat message by passing a prompt, e.g.
> `tell -w --no-exec "ola"`. The legacy `--sandbox-web` / positional `tell web`
> forms are removed.

Open **http://localhost:3000**. You get a dashboard with three areas:

1. **AI Chat & Workspace** — the general chat that manages the session.
2. **Console Interface** — the mirror of your shell (click the tab or the
   *Console Interface* button to maximize it).
3. **File explorer + editor** — browse and edit files on disk.

Click into any pane and run anything you would type in your own terminal:

```bash
tmux new-session -d -s work && tmux attach
codex                          # interactive CLI AI engine
opencode                       # another one
claude-code                    # and another
```

---

## Where to use it

The sandbox runs wherever you can run `node` and has access to a working directory.
That makes it useful in several very different situations.

### 1. Your own machine

The simplest case: a nicer UI for your local shell, with the AI assistant attached.

```bash
cd ~/my-project
tell --web
```

Use the panes for long-running interactive work (servers, dev servers, `tmux`
sessions) while the chat handles questions and edits. Sessions survive page reloads
via `.tell/`.

### 2. Manage a repo from anywhere

Run the sandbox **on the machine that holds the repository** (or on any machine you
have shell access to), then drive it from a browser on another device. You get full
git operations without installing anything on your laptop:

```bash
# On the server / machine that owns the repo:
cd /srv/git/my-repo
tell --web --model g

# From your browser anywhere: review the diff, edit files, commit and push.
# In a pane:
git status
git diff
git add -A && git commit -m "fix: typo in docs" && git push
```

The file explorer and editor are great for quick fixes; the panes give you a real
shell for `git`, `npm`, build tools, and migrations.

### 3. Manage an online server

Run it on a VPS / cloud instance to administer it with a graphical terminal instead
of remembering SSH flags. Useful for servers that lack a desktop:

```bash
# On the VPS, inside a tmux session so it survives disconnects:
tmux new -s tell
cd /opt/my-app
tell --web --model g
# detach with Ctrl-b d

# Reconnect to your work anytime:
tmux attach -t tell
```

Day-to-day ops become point-and-click:

- Read the config tree and edit files (e.g. `nginx.conf`, `.env`, `systemd` units)
- Tail logs live: `tail -f /var/log/my-app/app.log`
- Restart services: `systemctl restart my-app`
- Run one-off maintenance: `npm run migrate`, `docker compose up -d`

### 4. Via a website / hosted instance

Expose the sandbox so you can reach it from any browser, through a tunnel or a
reverse proxy. Pick the option that fits your setup.

**A. SSH reverse tunnel (no extra software on the server):**

```bash
# Server:
tell --web

# Your laptop:
ssh -L 3000:localhost:3000 user@your-server
# now open http://localhost:3000
```

**B. Cloudflare Tunnel (public URL):**

```bash
# Server:
tell --web
cloudflared tunnel --url http://localhost:3000
# Cloudflare prints something like https://random-words.trycloudflare.com
```

**C. ngrok:**

```bash
ngrok http 3000
```

**D. Systemd + reverse proxy (Nginx/Caddy) — always-on:**

`/etc/systemd/system/tell-web.service`:

```ini
[Unit]
Description=Tell Web Sandbox
After=network.target

[Service]
WorkingDirectory=/opt/my-app
Environment=PORT=3000
Environment=TELL_MODEL=g
ExecStart=/usr/bin/tell --web
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tell-web
```

Then put Nginx/Caddy in front with a real domain and **TLS**. Exposing a shell on the
public internet without authentication is dangerous — see
[Security notes](#security-notes).

---

## Real-world examples

**Example 1 — Fix a bug from a phone.**

You are away from your desk. Open the tunnel URL, go to the repo tab, search the
failing file, edit it in the browser, then in a pane run:

```bash
npm test
git add -A && git commit -m "fix: offset bug" && git push
```

**Example 2 — Run interactive AI CLIs in panes.**

Give each pane a different engine and let the general chat coordinate:

```bash
# pane 1
codex
# pane 2
opencode
# pane 3
claude-code
# pane 4 (or the chat) — tell-ai
tell -m d "review the current diff"
```

Each pane is a real terminal, so these tools render their full interactive UIs,
spinners, and prompts correctly.

**Example 3 — Keep long tasks alive with tmux.**

Start a build or a test server, detach, and come back later — the PTY session stays
alive even after you close the browser (it is garbage-collected after ~5 minutes
without a connection, and your scrollback is saved):

```bash
tmux new -s build
npm run dev
# Ctrl-b d to detach, close the browser, come back:
tmux attach -t build
```

**Example 4 — Admin an online service end-to-end.**

Edit `nginx.conf`, reload it, watch the log, and restart — all in parallel panes:

```bash
# pane 1
vim /etc/nginx/sites-available/my-site
# pane 2
sudo nginx -t && sudo systemctl reload nginx
# pane 3
tail -f /var/log/nginx/access.log
```

> `sudo` is blocked by the safety guard, so run Nginx under a user that owns the
> config, or run the whole sandbox with the privileges you need.

**Example 5 — Let the AI manage the repo through the chat.**

In the chat: *"run the linters, fix whatever fails, and commit the changes"*. The AI
drafts `<RUN>` commands, you authorize them (or enable Auto-Run), and each command
runs through the sandbox bridge with output fed back to the model.

---

## Session persistence (`.tell/`)

Everything auto-saves to a hidden folder in the working directory:

```
.tell/session.json                 # current state (atomic writes, debounced ~1.5s)
.tell/history/<timestamp>.json     # snapshots ("Snapshot Now" button in Settings)
.tell/latest -> history/...        # symlink to the most recent snapshot
```

Restored on your next visit: chat messages, selected model, system prompt, terminal
tabs/panes and their scrollback. The server additionally tracks:

- **Keys used** — provider names only, **never the actual key values**.
- **Files changed** — files edited via the browser editor plus `git status --porcelain`
  collected at snapshot time.
- **Usage stats** — commands run, AI turns, snapshots.

The *Session & History* panel in Settings shows stats, keys, changed files, and the
history list.

---

## Security notes

- **It is a shell in a browser.** Anyone who reaches the port can run commands as the
  user running `tell-web`. Never expose it to the public internet without a tunnel
  that enforces authentication, or a reverse proxy with auth (e.g. Basic auth,
  OAuth via `oauth2-proxy`), and TLS.
- **High-risk commands are blocked** by the sandbox guard: `sudo`, `rm -rf`, writes to
  system paths (`/etc`, `/boot`, `/usr`), `curl | sh`, crontab manipulation, `mkfs`,
  `dd of=`, etc. This is a heuristic, not a security boundary — treat it as
  best-effort.
- **API keys come from the environment** (`OPENAI_API_KEY`, etc.). The sandbox never
  stores key values — only the provider names you used.
- For untrusted or adversarial use, run the sandbox **inside a container or VM**
  (see below) so damage is contained.

**Docker (quick isolation):**

```bash
docker run --rm -it -p 3000:3000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $PWD:/workspace \
  -w /workspace \
  node:22 bash -c "npm i -g tell-ai @tell-ai/web && tell --web"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Failed to load native module: pty.node` | `node-pty` is a native module. Run `npm rebuild node-pty` (from `src/web`) or install build tools (`python3`, `make`, `g++`). |
| Port already in use | Set another port: `PORT=3100 tell --web` |
| Wrong model | Set `TELL_MODEL` (e.g. `TELL_MODEL=g tell --web`) or pick the model in the chat header. |
| Terminal looks blank / no prompt | Refresh the page; the PTY reconnects. Check the `.tell/` scrollback restore if a session exists. |
| `tell: command not found` for `tell-web` | Install the web server: `npm install -g @tell-ai/web` |
| Session not restored | The server must run from the same working directory (`.tell/` lives there). |
