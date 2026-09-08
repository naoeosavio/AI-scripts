# Changelog

## v0.5.2 — 2026-09-08

### Features

- Add Alibaba API key support to environment configuration loading
- Add `-w`/`--web` mode to launch the interactive Tell Web sandbox (`tell-web`): spawns the server with the selected model (`-m`), `--cwd` working directory (created with a warning when missing), `--prompt` pre-seed and `--no-exec`/`--chain`/`-y` passthrough; propagates the sandbox exit code and explains how to install `@tell-ai/web` when the binary is missing


### Fixes

- Tighten shell risk detection and expand coverage for remote execution vectors and piped downloads
- Reduce accumulated context threshold to optimize LLM window limits
- Defer model label resolution for graceful configuration error reporting
- Catch top-level errors to ensure formatted error messages and non-zero exit codes

---

## v0.5.1 — 2026-08-15

To generate the changelog section without any markdown fences or extraneous explanations:

### Features
- Add Z.ai model provider and GLM-5.3 support with OpenAI-compatible adapter
- Introduce browser-safe bundles and MIT license support in SDK
- Add custom base URLs and `tell` function for one-shot assistant calls
- Add addressable, named, and use-or-create context options in CLI
- Initialize core tell-ai terminal assistant CLI package and persistence

### Refactors
- Streamline context flags, addressing syntax, and unify `--ctx` usage
- Extract system prompt generation logic into SDK and dedicated modules
- Improve model spec detection and context argument handling in CLI
- Migrate CLI package to ESM modules and update workspace metadata

### Documentation
- Structure project README and add dedicated package readmes

### Chores
- Update project license, changelogs, and SDK versions across the monorepo

---

## v0.5.0 — 2026-08-05

### Features
- Split the codebase into a bun workspaces monorepo; `tell-ai` is now the CLI package (0.5.0), with model resolution, tag handling and summarization moved into the new `@tell-ai/sdk` library.
- Environment resolution (env vars + `~/.config/<vendor>.token` fallback) now lives exclusively in the CLI (`packages/cli/src/env.ts`), which assembles the `SDKConfig` for `create_ask_ai(spec, config)`.

### Refactors
- `tell_silently` now delegates to the SDK `tell()` (with `ask` + `raw`), making `tell()` the single implementation of "call the model with the tell system prompt" shared by CLI and web.
- `packages/cli/src/systemPrompt.ts` is now a thin wrapper around the SDK prompt, passing `process.cwd()` and platform info; CLI behavior unchanged.
- CLI package builds to a minified CJS bundle (`dist/Tell.js`, `#!/usr/bin/env node`) with `commander`; the SDK builds to ESM + CJS + declarations via tsup.
- Extracted the strict TypeScript configuration into `tsconfig.base.json`, extended by both packages.
- Root package is now a private workspace that orchestrates everything with `bun run --filter`.
- Removed `gpt-tokenizer` usage and the stale root `src/` layout (`src/ai`, `src/config`, `src/summarize.ts`, `src/Tell.ts`).

### Tests
- Security test suite now transpiles `packages/cli/src/Tell.ts` and mocks `@tell-ai/sdk` from the real built SDK (tag functions are exercised for real), depending on the SDK build step.

### Documentation
- Updated `AGENTS.md` to describe the monorepo architecture, package boundaries, and injected-config design.

---

## v0.4.2 — 2026-07-25

### Features
- Include reasoning text in AI responses, wrapping reasoning steps in ` thinking` tags when present.
- Expand context buffer capacity to 256 MiB and filter internal reasoning blocks (` thinking` tags) from conversation history.
- Implement incremental context saving to persist state during long-running conversation loops, with periodic file writes.
- Replace naive context truncation with AI-driven summarization when conversation history exceeds token limits, preserving critical information with fallback to truncation.

### Fixes
- Allow flexible model identifier resolution for custom thinking budgets and unknown vendors, falling back to single-part resolution when vendor is unrecognized.

### Refactors
- Update Claude Opus model identifiers to version 5 across all reasoning tiers.
- Update system prompt and execution loop behavior: refine prompt-injection policies, add `stripRunTags` helper, update `runResponseLoop`, and remove global AI SDK warnings configuration.
- Update model mappings: upgrade flash-lite to 3.5, flash to 3.6, adjust DeepSeek reasoning and flash tiers, add MoonshotAI Kimi K3 low and max variants, remove unnecessary type casting.
- Change feedback generation in response loop to use `conversationText` instead of `resultText` for full conversation context.

### Documentation
- Document flag interactions, including behavior between persistent context and multi-step chaining flags, with a flag interaction matrix added to README and usage guide.

---

## v0.4.1 — 2026-07-16

### Features

- Integrated MoonshotAI provider with reasoning effort configuration and new environment variable support for API key.
- Added model aliases for Gemini 3.1 Flash Lite, Fireworks GLM-5p2, and Moonshot Kimi models; refined Deepseek model shortcut mappings.
- Renamed Luna reasoning effort aliases from `m-*` to `c-*` and upgraded the default Gemini Flash model from 3.1-preview to 3.5.
- Bumped Claude Sonnet to v5 and Grok to 4.5 across all applicable reasoning effort levels.
- Migrated GPT-5.5 aliases to GPT-5.6 Sol series; introduced Terra and Luna model families with full reasoning effort range; replaced the `xhigh` effort level with `max`.
- Enhanced the command execution flow in the tell subsystem to capture and report exit codes, enabling failure‑aware AI decision‑making and automatic recovery.

---

## v0.4.0 — 2026-07-08

### Features

- Added command confirmation timeout: prompts auto-reject after a configurable period (`EXEC_TIMEOUT`), preventing indefinite hangs.
- Ensured the assistant's visible response is always printed when the chain limit is reached or auto-continue is disabled.
- Model responses now strip ` thinking` blocks before command extraction and output, preventing commands inside think tags from being executed.
- Improved model selection for Vast and Local providers by consistently using `provider.chat(model)`; added response filtering for run command extraction.

### Fixes

- Separated error handling for AI interactions and context file writes to avoid unhandled exceptions; context write failures now log and set a non-zero exit code.
- Fixed an issue where the assistant's visible response was not printed when the conversation chain limit was reached or auto-continue was disabled.

### Refactors

- Dropped the unused `messages` array and `ChatMessage` type from conversation state; narrowed the error handling scope in `runTell` to only cover the AI creation call.
- Removed the `suppressStdout` function and simplified `tellSilently`; suppressed Vercel AI SDK warnings via a global flag.
- Centralized API key and base URL configuration into a new `env` config module with typed keys, default URLs, and simplified provider key lookup.

### Performance

- Cached directory creation tracking to avoid redundant `mkdirSync` calls during conversations.
- Used the model label instead of the raw model string for context file hashing, ensuring stable filenames across runs.

### Documentation

- Added comprehensive git suite examples and integration reference covering git hooks, CI/CD, editors, bots, and self-hosted servers.
- Added a usage guide detailing model selection, command execution, piped input, chain mode, persistent context, and logging.
- Updated README with environment variable API key configuration for all providers (including Deepseek, Cerebras, OpenRouter) and self-hosted endpoint setup.

### Tests

- Added tests for command extraction with visible surrounding text and multi-command chaining.
- Removed outdated vendor-stdout-injection security test.

### Chores

- Relicensed from MIT to GPL-3.0; added LICENSE file and updated package.json license field, repository, bugs, and homepage URLs.

---

## v0.3.2 — 2026-07-08

### Features
- Introduced `tell` CLI for querying AI models and executing approved bash commands with safety checks. Supports multiple AI providers, persistent context per directory/model, chain-mode multi-step reasoning, piped stdin, and command execution toggle. Logs full conversations and includes heuristic detection for high-risk scripts.

### Documentation
- Added comprehensive README covering installation, usage, configuration, and security considerations.

### Tests
- Added security test suite covering prompt injection, risky command handling, exec controls, chain limits, and context hygiene.

### Chores
- Initialized project configuration with `.gitignore`, `package.json`, and `tsconfig.json`.
