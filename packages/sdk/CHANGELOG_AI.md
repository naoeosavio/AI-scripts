# Changelog

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