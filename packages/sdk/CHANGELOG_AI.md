# Changelog

## v0.2.2 — 2026-09-08

### Features
- Export `get_model` and the `ModelHandle` type so Node consumers (e.g. the web server) can resolve a vendor provider handle for multi-turn `generateText()` calls without going through `create_ask_ai()`
- Add new model shortcut tiers (e.g., `e`, `r`, `al`, `af`, `zf`, `m`) and update provider model versions
- Add support for the Cerebras vendor and dedicated handler

### Fixes
- Tighten OpenAI vendor detection and improve base URL handling defaults
- Resolve `:fast` model aliases correctly in model spec parsing and unify reasoning configuration

### Tests
- Add comprehensive test suite covering web backend functionality, chat threads, session management, terminal layout, PTY, HTTP routes, and server guards
- Add dedicated `test/test-sdk.js` suite (wired as `test:sdk`, first in `npm test`): public export surface, `resolve_model_spec` aliases/fast/thinking budgets, `MODELS` table round-trip invariant, offline `get_model` handles (incl. vast/local URL errors), exec/no-exec system prompts and tag helpers
---

## v0.2.1 — 2026-08-15

### Features
- Overhaul CLI context management to use explicit flags and namespaces with strict validation
- Add Z.ai model provider and GLM-5.3 support
- Update model mappings and version tiers across Gemini, Google, X.ai, and DeepSeek
- Introduce browser-safe bundles, Node module shims, and global IIFE build support
- Add custom base URLs per model vendor and introduce the `tell` programmatic assistant function

### Refactors
- Extract system prompt generation to SDK and support alternative execution variants
- Migrate CLI package output from CommonJS to ESM modules and enhance package metadata
- Modularize ask functionality and update package exports

### Documentation
- Structure project README and add dedicated package README files for the CLI and SDK

### Chores
- Update project license to MIT and synchronize workspace package versions and documentation references

---

## 0.2.0 — 2026-08-11

### Features
- Browser bundles are now truly self-contained and browser-loadable: `dist/browser.js` (ESM, `@tell-ai/sdk/browser`) and `dist/browser-global.global.js` (IIFE, `@tell-ai/sdk/browser-global`, assigns `globalThis.TellSDK`, listed in `sideEffects`, also the `unpkg`/`jsdelivr` targets).
- `tsup.config.ts` now lists `ai` and every `@ai-sdk/*` provider in `noExternal` explicitly — a `'@ai-sdk/*'` glob does not match scoped packages and previously produced bundles with bare imports that browsers cannot resolve.
- Node builtins (`path`, `fs`, `os`) pulled in by `@vercel/oidc` (transitive dependency of `ai`) are aliased at build time to `src/shims/node.cjs`, and a `var process = { version:'', env:{}, platform:'browser' }` banner covers its module-scope user-agent construction. The OIDC token helpers are never exercised in the browser, but they used to crash bundle initialization (`Dynamic require of "path"`).
- Added `examples/web/` demo (served by the Bun `proxy.ts`): a no-build page using the IIFE `TellSDK` build, Google auth via the `x-goog-api-key` header (replacing `Authorization: Bearer`), server-side key injection with a `proxy` placeholder, and a `demo.ts` end-to-end walkthrough.
- License changed from GPL-3.0 to MIT.

### Documentation
- New `docs/sdk/imports.md` comparing the three build variants (Node ESM/CJS, browser ESM, browser global IIFE) with loading and tree-shaking guidance.

---

## 0.1.1 — 2026-08-07

### Features
- New `tell(message, options)` function — `tell --no-exec` as a library call. Builds the tell system prompt (execution disabled by default), calls `create_ask_ai`, and returns the final answer with ` thinking`/`<RUN>` tags stripped. Supports injected `keys`/`urls` (browser-safe, no environment reads), optional `context` prefix, custom `system` override, `ask` (reuse an existing `AskInstance`) and `raw` (skip tag stripping) options.
- The tell system prompt moved into the SDK (`get_system_prompt` with `PromptOptions { chain?, exec?, cwd?, platform? }`), shared by the CLI and web. `exec: false` produces a no-execution variant that forbids `<RUN>` and instructs the model to answer in plain text.
- `create_ask_ai`/`AskInstance` moved to `src/ask.ts` (re-exported from the SDK index) to avoid circular imports.
- All provider handlers now honor `SDKConfig.urls` per vendor (openai, anthropic, google, xai, deepseek, fireworks, cerebras, moonshotai) via `baseURL`, enabling CORS proxies for browser use.
- New browser bundle `dist/browser.js` (`@tell-ai/sdk/browser` export): self-contained ESM that bundles `ai` + all providers, importable directly in the browser without a build step.
- Added `examples/web/` — a no-build demo page (`index.html`) using `tell()` with per-vendor keys stored in localStorage, and an optional Bun CORS proxy (`proxy.ts`) that forwards `/vendor/*` to provider APIs and injects keys from env.

---

## 0.1.0 — 2026-08-05

### Features
- Initial release: `@tell-ai/sdk`, a browser-safe AI provider layer born from the tell-ai monorepo split (same parent release as tell-ai v0.5.0).
- All environment concerns are received via an injected `SDKConfig` (`keys`/`urls`, both partial); zero `node:*` imports and zero `process.env` reads, so it runs in browsers, Node, and Bun without changes.
- `MODELS`, `resolve_model_spec`, provider dispatch, `<RUN>`/` thinking`/markdown tag functions, and `summarize_context` moved in from the CLI, exported from `packages/sdk/src/index.ts`.
- The SDK type-checks without `@types/node` to enforce browser safety.
