# AGENTS.md

This file provides guidance to AI when working with code in this repository.

## Repository expectations

- Use `bun` as the package manager (not npm/pnpm/yarn for installing dependencies).
- Formatting and linting are handled by Biome v2.2.6 (config in `biome.json`): single quotes, 2-space indent, 120-char line width.
- Monorepo workspace (bun): `packages/sdk` (`@tell-ai/sdk`, browser-safe LIB) and `packages/cli` (`tell-ai`, bin `tell`).

## Build / test / lint / format

All commands run from the root and delegate to the packages:

```bash
npm run build          # builds @tell-ai/sdk (ESM+CJS+dts + 2 browser bundles) then tell-ai (minified CJS, bun shebang)
npm run lint           # tsc --noEmit in both packages (type-check only)
npm run format         # biome check --write packages/  (auto-fix formatting)
npm run check          # biome check packages/  (check only)
npm test               # alias for test:security
npm run test:security  # build the SDK, then node test/test-tell-security.js
npm run ci             # build + lint + format check + test (runs in order)
```

TypeScript is checked with `tsc` but bundled with `tsup` (ESBuild). Entry points: `packages/sdk/src/index.ts` → `packages/sdk/dist/` and `packages/cli/src/Tell.ts` → `packages/cli/dist/Tell.js`. The SDK build also emits two browser bundles from `src/browser.ts` + `src/browser-global.ts`. After building, sanity-check them with `grep -cE '^import ' packages/sdk/dist/browser*.js` — must be `0` (self-contained; bare imports/dynamic `require` break the browser).

## Architecture

`tell-ai` is a one-shot terminal assistant — a CLI that sends a prompt to an LLM and optionally executes bash commands the model returns inside `<RUN>...</RUN>` tags. It supports 10+ AI vendors through short model aliases, persistent conversation context, and a chain mode for iterative command sequences.

The codebase has three layers:

### Monorepo root (bun workspace)

- `package.json` — private, `"workspaces": ["packages/*"]`, orchestration scripts via `bun run --filter @tell-ai/sdk …` / `--filter tell-ai`.
- `tsconfig.base.json` — strict shared TS config (noUncheckedIndexedAccess, exactOptionalPropertyTypes, erasableSyntaxOnly…), extended by both packages.

### LIB: `packages/sdk` (`@tell-ai/sdk` — ~600 lines)

Browser-safe AI provider layer: **zero `node:*` imports, zero `process.env` reads**. All environment concerns are injected via `SDKConfig` (`{ keys, urls }`, both partial). Built by tsup to ESM + CJS + `.d.ts`/`.d.cts`.

Key exports from `packages/sdk/src/index.ts`:
- **`MODELS`** — Record of 70+ short aliases (e.g., `g` → `openai:gpt-5.6-sol:medium`)
- **`resolve_model_spec(model)`** — Parses `vendor:model:thinking` specs, handles dot-prefix fast mode
- **`create_ask_ai(spec, config)`** — Returns an `AskInstance` with an `ask()` method backed by `generateText()`
- **`tell(message, options)`** — `tell --no-exec` as a function: builds the system prompt (execution disabled by default), calls the model, returns the answer with `<think>`/`<RUN>` stripped. `TellOptions`: `model?`, `keys?`, `urls?`, `exec?`, `cwd?`, `platform?`, `context?`, `system?`, `ask?` (reuse an existing `AskInstance`), `raw?` (skip stripping, used by the CLI's `tell_silently`)
- **`get_system_prompt(options)`** — Shared tell system prompt with `PromptOptions { chain?, exec?, cwd?, platform? }`; `exec: false` emits the no-command-execution variant used by `tell()` in the browser
- **`extract_runs`, `strip_run_tags`, `strip_think_tags`, `strip_markdown_code_blocks`** — `<RUN>`/`<think>`/markdown handling
- **`summarize_context(ai, text)`** — AI-driven conversation history compression

Files:
- `src/index.ts` — public exports
- `src/browser.ts` — browser ESM entry (re-exports the browser-safe API)
- `src/browser-global.ts` — IIFE entry: assigns `globalThis.TellSDK`
- `src/shims/node.cjs` — CJS stubs for `path`/`fs`/`os` aliased into the browser bundles (see below)
- `src/ask.ts` — `create_ask_ai()` factory, `AskInstance`
- `src/models.ts` — `MODELS` table, alias resolution, provider instances, injected key/url lookup (all providers honor `config.urls` via `baseURL`)
- `src/config.ts` — `SDKConfig`/`SDKKeys`/`SDKUrls` types (partial, injected)
- `src/systemPrompt.ts` — shared exec/no-exec system prompt (`get_system_prompt()`), `PromptOptions`
- `src/tell.ts` — `tell()` one-shot no-exec function
- `src/tags.ts` — pure `<RUN>`/` thinking`/code-block strip & extract functions
- `src/summarize.ts` — `summarize_context`

Builds: tsup emits ESM + CJS + dts (`dist/`) plus two self-contained browser bundles: `dist/browser.js` (ESM, exported as `@tell-ai/sdk/browser`) and `dist/browser-global.global.js` (IIFE, `@tell-ai/sdk/browser-global`, defines `globalThis.TellSDK`, listed in `sideEffects`; also the `unpkg`/`jsdelivr` targets).

To keep the browser bundles self-contained, `tsup.config.ts` lists `ai` + all `@ai-sdk/*` providers in `noExternal` **explicitly** — a `'@ai-sdk/*'` glob does not match scoped packages and silently leaves bare imports. `@vercel/oidc` (a transitive dep of `ai`) requires `path`/`fs`/`os` and touches `process` at module scope, so those builtins are aliased to `src/shims/node.cjs` and a `var process = { version:'', env:{}, platform:'browser' }` banner is prepended. Full variant comparison: `docs/sdk/imports.md`.

### CLI: `packages/cli` (`tell-ai` — ~500 lines)

Single-file Node entry point for the `tell` binary (CJS bundle, `#!/usr/bin/env node`). Uses `commander` for CLI parsing. Key behaviors:
- Reads piped stdin (30s timeout, `-i` flag)
- Extracts `<RUN>...</RUN>` tags from AI responses and prompts before executing commands
- `--chain` iterates up to 8 steps, feeding command outputs back to the model
- `-c` persists the default per-directory+model context (SHA-256 hash, `~/.ai/tell_context/`)
- `--ctx [ref]` use-or-create context: bare = default context (`-c` synonym); `@N` (recency) or `#hash` prefix (must exist); name (created if missing); multi-word value = prompt text for the default context (unnamed contexts are never saved)
- `-n` reset modifier: `--ctx <name> -n` starts empty, even if the name exists
- `-l` lists saved contexts (`@N`, id, age, preview)
- `-y` auto-executes commands (high-risk commands still require confirmation)
- `--no-exec` disables all command execution

**Security**: `isHighRiskScript()` blocks patterns like `sudo`, `rm -rf`, `dd of=`, `curl|sh`, `mkfs`, writes to system paths (`/etc`, `/boot`, `/usr`, systemd units), crontab manipulation, etc. Execution timeout is 120s.

Files:
- `src/Tell.ts` — CLI: commander, stdin, exec, confirm/high-risk, context/logs, loop chain, main
- `src/systemPrompt.ts` — the `<RUN>`/injection-policy execution system prompt (`get_system_prompt()`), with `PromptOptions`
- `src/env.ts` — Node-only: reads `process.env` + `~/.config/<vendor>.token` files, assembles the `SDKConfig` passed to `create_ask_ai()`

### Model alias conventions

- **First character(s)** = vendor+model: `g` = GPT-5.6 Sol, `o` = Claude Opus 5, `s` = Claude Sonnet 5, `f` = Claude Fable 5, `l` = Gemini 3.6 Flash, `j` = Gemini 3.5 Flash Lite, `d` = DeepSeek V4 Flash, `z` = GLM-5.3 (Z.ai)
- **Suffix** = thinking budget: `--` none, `-` low, (none) medium, `+` high, `++` xhigh/max
- **Dot prefix** (`.g`) = fast mode
- **Self-hosted**: `q` = local `/root/model`, `v` = vast `/root/model`

Canonical format: `vendor:official_model_name:thinking_budget` (e.g., `openai:gpt-5.6-sol:high`).

## Dependencies

- **[ai](https://sdk.vercel.ai)** — AI SDK core (`generateText`)
- **[@ai-sdk/openai](https://www.npmjs.com/package/@ai-sdk/openai)** — OpenAI provider
- **[@ai-sdk/anthropic](https://www.npmjs.com/package/@ai-sdk/anthropic)** — Anthropic provider
- **[@ai-sdk/google](https://www.npmjs.com/package/@ai-sdk/google)** — Google provider
- **[@ai-sdk/xai](https://www.npmjs.com/package/@ai-sdk/xai)** — xAI Grok provider
- **[@ai-sdk/deepseek](https://www.npmjs.com/package/@ai-sdk/deepseek)** — DeepSeek provider
- **[@ai-sdk/fireworks](https://www.npmjs.com/package/@ai-sdk/fireworks)** — Fireworks provider
- **[@ai-sdk/cerebras](https://www.npmjs.com/package/@ai-sdk/cerebras)** — Cerebras provider
- **[@ai-sdk/openai-compatible](https://www.npmjs.com/package/@ai-sdk/openai-compatible)** — OpenAI-compatible provider (Z.ai GLM via `zai:` vendor)
- **[commander](https://www.npmjs.com/package/commander)** — CLI argument parsing

The provider packages above are dependencies of `@tell-ai/sdk`; `commander` lives in `tell-ai`.

## API key configuration

API keys are resolved only in the CLI (`packages/cli/src/env.ts`): env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, etc.) with fallback to `~/.config/<vendor>.token` files, then injected into the SDK as `SDKConfig`. The SDK never touches the environment itself.

## Related docs

- `docs/sdk/imports.md` — SDK build variants (Node ESM/CJS vs browser ESM vs IIFE global)
- `docs/usage.md`, `docs/integrations.md` — CLI usage and integrations
- `examples/web/` — browser demo: `proxy.ts` (API proxy + static serving) + `index.html` (uses the IIFE `TellSDK` build) + `demo.ts` (end-to-end walkthrough)
- `packages/sdk/CHANGELOG_AI.md`, `packages/cli/CHANGELOG_AI.md` — Version history per package
