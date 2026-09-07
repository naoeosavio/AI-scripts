# Tell Web

Sandbox web do Tell AI: chat com modelos, explorador/visualizador de arquivos,
execução de comandos e terminal PTY — tudo ancorado num diretório de trabalho (`--cwd`).

## Requisitos

Node.js `>=20` (ver `engines` em `package.json`).

## Rodar

```sh
npm i
npm run dev      # frontend vite + server tsx (desenvolvimento)
npm run build    # tsup (server.js) + vite build (assets) → dist/
npm start        # node dist/server.js (produção)
```

## CLI

```sh
tell-web --cwd <path> --prompt <text> -m <modelo> --chain -y/--no-exec
tell-web --help
```

| Flag | Padrão | Descrição |
|---|---|---|
| `--cwd <path>` | cwd atual | Diretório do sandbox |
| `--prompt <text>` | — | Prompt inicial do chat |
| `-m, --model <id>` | `TELL_MODEL` ou `l` | Shortcode ou spec do modelo |
| `--port <n>` | `PORT` ou `3000` | Porta TCP |
| `--host <addr>` | `127.0.0.1` | Bind address (`0.0.0.0` p/ LAN) |
| `--exec-timeout <ms>` | `120000` (máx `600000`) | Timeout por comando |
| `--chain` | off | Continua após output até resposta final |
| `-y, --yes` | off | Auto-confirma execução |
| `--no-exec` | off | Desabilita execução automática |
| `-h, --help` | — | Ajuda |

## Envs (ver `.env.example`)

`PORT`, `TELL_MODEL`, `TELL_TOKEN` (auth `Bearer` em `/api/*` exceto
`/api/config`, e `?token=` no WS) + chaves dos vendors (`GEMINI_API_KEY`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`,
`FIREWORKS_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, …).

## Endpoints `/api/*`

| Método | Rota | Notas |
|---|---|---|
| GET | `/api/status` | Árvore de arquivos do workspace |
| GET | `/api/file?path=` | Conteúdo + `mtime` (403 traversal/sensível, 413 >10MB) |
| GET | `/api/file/raw?path=` | Download bytes |
| POST | `/api/save-file` | `{path, content, expectedMtime}` (409 se mudou em disco) |
| POST | `/api/execute` | `{command}` — bloqueia padrões de alto risco, 429 (10/min, máx 2 concorrentes) |
| GET | `/api/models` | Modelos/aliases + `keysStatus` por vendor |
| GET | `/api/config` | `defaultModel`, `autoExecute`, `chain`, `yes`, `cwd` (sem auth) |
| GET | `/api/context` | System prompt gerado (árvore + README + convenções) |
| POST | `/api/tell` | `{messages, modelAlias?, systemPrompt?}` (400 payload inválido, 429) |
| GET/PUT | `/api/session` | Estado persistido + fatos do servidor + scrollbacks vivos |
| GET | `/api/session/history` | Lista snapshots |
| GET/DELETE | `/api/session/history/:name` | Lê/remove snapshot (`:name` precisa terminar em `.json`) |
| POST | `/api/session/snapshot` | `{success, name, gitChanges, history}` |
| WS | `/api/terminal?paneId=&cols=&rows=` | PTY (`?token=` quando `TELL_TOKEN`) |

Arquivos sensíveis nunca expostos: `.env*` (exceto o template `.env.example`), `.tell/**`, `.git/**`, `*.key`, `*.pem`.

## Layout `.tell/` (local, ignorado pelo git)

```
.tell/
  session.json   # sessão atual
  history/       # snapshots *.json
  latest -> history/<snapshot>  # symlink (reparado se dangling)
```
