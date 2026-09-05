# Environment and configuration

The CLI is the only layer that touches the environment. It assembles an `SDKConfig { keys, urls }` (both partial) and injects it into `create_ask_ai`. The SDK never reads `process.env` itself.

## `load_sdk_config` (`src/env.ts:19-42`)

Keys: env var first, `~/.config/<vendor>.token` file fallback (trimmed, empty ignored via `read_token_file`, `src/env.ts:10-18`).

| SDK key | Env var(s) | Token file |
|---------|-----------|------------|
| `openai` | `OPENAI_API_KEY` | `~/.config/openai.token` |
| `anthropic` | `ANTHROPIC_API_KEY` | `~/.config/anthropic.token` |
| `google` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | `~/.config/google.token` |
| `xai` | `XAI_API_KEY` | `~/.config/xai.token` |
| `deepseek` | `DEEPSEEK_API_KEY` | `~/.config/deepseek.token` |
| `fireworks` | `FIREWORKS_API_KEY` | `~/.config/fireworks.token` |
| `cerebras` | `CEREBRAS_API_KEY` | `~/.config/cerebras.token` |
| `moonshotai` | `MOONSHOTAI_API_KEY` | `~/.config/moonshotai.token` |
| `openrouter` | `OPENROUTER_API_KEY` | `~/.config/openrouter.token` |
| `alibaba` | `ALIBABA_API_KEY` | `~/.config/alibaba.token` |
| `zhipu` (vendor `zai`) | `ZHIPU_API_KEY` | `~/.config/zhipu.token` |

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."        # or GEMINI_API_KEY
export DEEPSEEK_API_KEY="..."
echo -n "sk-..." > ~/.config/openai.token   # fallback when env is unset
```

URLs (`SDKUrls`): `openai` defaults to `https://api.openai.com/v1`, `deepseek` to `https://api.deepseek.com`, `openrouter` to `https://openrouter.ai/api/v1`, `zhipu` to `$ZHIPU_BASE_URL` or `https://api.z.ai/api/paas/v4`. Self-hosted vendors have no default and fail clearly when unset: `vast` requires `VAST_BASE_URL`, `local` requires `LOCAL_OPENAI_BASE_URL` (errors from `packages/sdk/src/models.ts:549-562`).

```bash
export VAST_BASE_URL="http://..."
tell v "summarize this file"
export LOCAL_OPENAI_BASE_URL="http://localhost:8080/v1"
tell q "explain this code"
export ZHIPU_BASE_URL="https://proxy.example/v1"   # optional override for vendor zai
```

## CLI-only variables

| Variable | Read at | Default | Meaning |
|----------|---------|---------|---------|
| `TELL_MODEL` | `Tell.ts:24` (module scope) | `'g'` | Default model when no positional/`-m` given |
| `DEBUG` | `src/env.ts:8` (`'true'`/`'1'`) | unset | Exported SDK-config debug flag (currently no verbose logging wired in `Tell.ts`) |

## System prompt wiring (`src/systemPrompt.ts:6-12`)

```ts
sdk_get_system_prompt({ ...(chain !== undefined ? { chain } : {}), cwd: process.cwd(), platform: `${os.platform()} ${os.release()}` })
```

Thin wrapper: same shared prompt the SDK `tell()` uses, plus live cwd and `platform release` so the model proposes correct local commands. `tell_silently` passes `{ chain: autoContinue }` on the first call and `{ chain: true }` on chain follow-ups (`Tell.ts:600-625`); the non-chain final-answer call uses `{ chain: false }`.

All providers honor `config.urls.*` as `baseURL`, so a proxy URL works for any vendor that defines one.

Sources: `src/env.ts`, `src/systemPrompt.ts`, `Tell.ts:24`, `Tell.ts:460-471`, `packages/sdk/src/models.ts:210-230`.
