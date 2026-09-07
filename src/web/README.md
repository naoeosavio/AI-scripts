# Tell Web

Tell AI web sandbox: chat with models, file explorer/viewer,
command execution and PTY terminal — all anchored to a working directory (`--cwd`).

## Requirements

Node.js `>=20` (see `engines` in `package.json`).

## Run

```sh
npm i
npm run dev      # vite frontend + tsx server (development)
npm run build    # tsup (server.js) + vite build (assets) → dist/
npm start        # node dist/server.js (production)
```

## CLI

```sh
tell-web --cwd <path> --prompt <text> -m <model> --chain -y/--no-exec
tell-web --help
```

| Flag | Default | Description |
|---|---|---|
| `--cwd <path>` | current cwd | Sandbox directory |
| `--prompt <text>` | — | Initial chat prompt |
| `-m, --model <id>` | `TELL_MODEL` or `l` | Model shortcode or spec |
| `--port <n>` | `PORT` or `3000` | TCP port |
| `--host <addr>` | `127.0.0.1` | Bind address (`0.0.0.0` for LAN) |
| `--exec-timeout <ms>` | `120000` (max `600000`) | Timeout per command |
| `--chain` | off | Continue after output until final answer |
| `-y, --yes` | off | Auto-confirm execution |
| `--no-exec` | off | Disable automatic execution |
| `-h, --help` | — | Help |

## Envs (see `.env.example`)

`PORT`, `TELL_MODEL`, `TELL_TOKEN` (`Bearer` auth on `/api/*` except
`/api/config`, and `?token=` on WS) + vendor keys (`GEMINI_API_KEY`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`,
`FIREWORKS_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, …).

## Endpoints `/api/*`

| Method | Route | Notes |
|---|---|---|
| GET | `/api/status` | Workspace file tree |
| GET | `/api/file?path=` | Content + `mtime` (403 traversal/sensitive, 413 >10MB) |
| GET | `/api/file/raw?path=` | Download bytes |
| POST | `/api/save-file` | `{path, content, expectedMtime}` (409 if changed on disk) |
| POST | `/api/execute` | `{command}` — blocks high-risk patterns, 429 (10/min, max 2 concurrent) |
| GET | `/api/models` | Models/aliases + `keysStatus` per vendor |
| GET | `/api/config` | `defaultModel`, `autoExecute`, `chain`, `yes`, `cwd` (no auth) |
| GET | `/api/context` | Generated system prompt (tree + README + conventions) |
| POST | `/api/tell` | `{messages, modelAlias?, systemPrompt?}` (400 invalid payload, 429) |
| GET/PUT | `/api/session` | Persisted state + server facts + live scrollbacks |
| GET | `/api/session/history` | List snapshots |
| GET/DELETE | `/api/session/history/:name` | Read/delete snapshot (`:name` must end in `.json`) |
| POST | `/api/session/snapshot` | `{success, name, gitChanges, history}` |
| WS | `/api/terminal?paneId=&cols=&rows=` | PTY (`?token=` when `TELL_TOKEN`) |

Sensitive files never exposed: `.env*` (except the `.env.example` template), `.tell/**`, `.git/**`, `*.key`, `*.pem`.

## `.tell/` layout (local, git-ignored)

```
.tell/
  session.json   # current session
  history/       # snapshots *.json
  latest -> history/<snapshot>  # symlink (repaired if dangling)
```
