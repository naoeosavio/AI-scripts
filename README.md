# tell-ai

One-shot terminal assistant, powered by an AI that can execute bash commands. Ask a question, get an answer — and optionally, a command executed for you.

## What it includes

| Package | Description | License |
|---|---|---|
| [`tell-ai`](./packages/cli/README.md) | The `tell` terminal CLI — one prompt at a time, with optional command execution | GPL-3.0 |
| [`@tell-ai/sdk`](./packages/sdk/README.md) | Browser-safe AI provider library: model resolution, multi-vendor dispatch, RUN/think tag handling, context summarization | MIT |

The CLI bundles the SDK and resolves API keys from your environment; the SDK works in Node, Bun, and the browser with all configuration injected.

## Quick start

```bash
npm install -g tell-ai
tell "explain this directory"
tell d "run ls -la"   # asks before executing
```

Set your API keys with environment variables (see the [CLI README](./packages/cli/README.md#api-keys)).

## Key ideas

- **One-shot by default** — no conversation loop unless you ask for one (`-c` persistent context, `--chain` multi-step reasoning).
- **Interactive execution** — the model proposes `<RUN>...</RUN>` commands and you approve them; `-y` auto-executes, `--no-exec` never executes.
- **10+ vendors through short aliases** — `g` for GPT-5.6 Sol, `o` for Claude Opus 5, `d` for DeepSeek V4 Flash, and more, with thinking-level suffixes (`+`, `++`).
- **Browser-safe SDK** — ships a self-contained ESM bundle and a script-tag global, no build step needed for the web.

## Development

Monorepo (bun workspaces) with two packages. All commands run from the root:

```bash
tell --chain "find out why the build is failing and fix it"
```

Include piped input with a prompt:

```bash
npm run build 2>&1 | tell --chain  -i "what should I fix first?"
git diff --staged | tell --input "review this change"
```

Tell logs conversations under `~/.ai/tell_history`.

### Flag interactions

| Flags | Reads context? | Deletes? | Writes? | Loop? |
|-------|--------|---------|--------|------|
| *(none)* | no | yes | no | no |
| `-c` | yes | no | yes (final) | no |
| `--chain` | no | yes | no | yes (8 rounds) |
| `-c --chain` | yes | no | yes (incremental) | yes (8 rounds) |

API Keys
--------

Set environment variables (preferred) or use `~/.config/<vendor>.token` files as fallback.

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."        # or GEMINI_API_KEY
export XAI_API_KEY="..."
export DEEPSEEK_API_KEY="..."
export FIREWORKS_API_KEY="..."
export CEREBRAS_API_KEY="..."
export MOONSHOTAI_API_KEY="..."
export OPENROUTER_API_KEY="..."
```

Token files (fallback):

```bash
~/.config/openai.token
~/.config/anthropic.token
~/.config/google.token
~/.config/xai.token
~/.config/deepseek.token
~/.config/fireworks.token
~/.config/cerebras.token
~/.config/moonshotai.token
~/.config/openrouter.token
```

Self-hosted endpoints (optional):

```bash
export VAST_BASE_URL="http://..."
export LOCAL_OPENAI_BASE_URL="http://localhost:8080/v1"
```

Security Tests
--------------

Run the prompt-injection and command-execution safety checks with:

```bash
npm run test:security
```

License
-------

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

The repository is licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE). The `@tell-ai/sdk` package is separately licensed under MIT (see `packages/sdk/LICENSE`).