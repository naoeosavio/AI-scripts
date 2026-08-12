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
npm run build   # build SDK (ESM+CJS+types+2 browser bundles) then CLI (minified CJS)
npm run lint    # tsc --noEmit in both packages
npm run format  # biome check --write packages/
npm run check   # biome check packages/
npm test        # security tests (prompt injection, command execution safety)
npm run ci      # build + lint + format check + test
```

Requirements: [bun](https://bun.sh) (package manager and runner), Node.js, TypeScript.

## Documentation

- [CLI usage](./packages/cli/README.md)
- [SDK usage / browser integration](./packages/sdk/README.md)
- [Usage guide](./docs/usage.md), [integrations](./docs/integrations.md) — git hooks, CI/CD, bots, self-hosted models
- [SDK build variants](./docs/sdk/imports.md) — Node ESM/CJS vs browser ESM vs IIFE global

## License

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

The repository is licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE). The `@tell-ai/sdk` package is separately licensed under MIT (see `packages/sdk/LICENSE`).