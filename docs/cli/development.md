# Development

## Layout

```
packages/cli/
  package.json       # name tell-ai 0.5.1, bin tell → dist/Tell.mjs, deps @tell-ai/sdk + commander
  tsup.config.ts     # entry src/Tell.ts → ESM .mjs, minified, #!/usr/bin/env node
  tsconfig.json      # extends ../../tsconfig.base.json, types [node], noEmit
  src/Tell.ts        # CLI (752 lines)
  src/env.ts         # load_sdk_config (Node-only)
  src/systemPrompt.ts# get_system_prompt wrapper (cwd + platform)
  dist/Tell.mjs      # built artifact (chmod +x)
```

Root orchestration (`package.json:9-18`, bun workspaces `packages/*`):

```bash
npm run build          # SDK (ESM+CJS+dts+2 browser) then CLI (minified .mjs)
npm run lint           # tsc --noEmit in both packages
npm run format         # biome check --write packages/
npm run check          # biome check packages/
npm run test:security  # build SDK, then node test/test-tell-security.js
npm run test           # test:security + test:context
npm run ci             # build + lint + format check + test
```

Package script (`packages/cli/package.json:10-16`): `build: tsup && chmod +x dist/Tell.mjs`, `lint: tsc -p tsconfig.json`, `format/check: biome … src`, `ci: lint + check + build`. Formatting: Biome 2.2.6, single quotes, 2-space, 120 cols (`biome.json`).

## Build notes

`tsup.config.ts`: `entry: ['src/Tell.ts']`, `format: ['esm']`, `outExtension: .mjs`, `dts: false`, `minify: true`, banner shebang. Output is executable (`chmod +x`); `bin.tell` points at it. Strict TS comes from `tsconfig.base.json` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, …).

## Test harness

Both suites avoid network/LLM by transpiling the real `Tell.ts` (`typescript.transpileModule`, CJS/ES2020) and running it in a `vm` sandbox with:

* `@tell-ai/sdk`: real module spread, but `create_ask_ai` stubbed to replay canned responses while recording `{ message, options }`.
* `./env`: `load_sdk_config → { keys: {}, urls: {} }`.
* `./systemPrompt`: delegates to the real SDK `get_system_prompt`.
* `child_process.exec[promisify.custom]`: records scripts, returns canned stdout/stderr.
* `os.homedir`: redirected into a temp dir; `process.cwd`: temp work dir; `argv/stdin/stdout/stderr/exitCode`: faked.

`test/test-tell-security.js` (348 lines): risky-script skips, injection policy, stdin shapes, `<RUN>`/`<think>` extraction, chain, context hygiene. `test/test-tell-context.js` (587 lines, 22 tests): addressing (`@N`, `#hash`, names), `-n` reset + traversal rejection, `-l`, multi-word semantics, incremental-save non-duplication, poisoned-context safety.

```bash
bun run test:security   # via root; builds SDK first (tag fns exercised for real)
bun run test            # both suites
```

## Touch points for contributors

* New flag: `CliOptions` + `build_program` + `build_context_plan`/`run_tell` wiring + `format_missing_prompt_error` if it affects required input; add cases to both suites.
* New high-risk shape: one regex in `is_high_risk_script` + one entry in `docs/cli/security.md` table + one `riskyScripts` line in the security suite. Keep local-only one-liners allowed unless they gain a network/decode token.
* Context semantics: `ContextPlan` is the contract — update `docs/cli/context.md` alongside `resolve_or_create_context_ref`/`build_context_plan`.
* Model/alias changes live in the SDK (`packages/sdk/src/models.ts`); the CLI only calls `resolve_model_spec`/`model_label`. Never read `process.env` from the SDK.

Sources: `package.json`, `packages/cli/package.json`, `packages/cli/tsup.config.ts`, `packages/cli/tsconfig.json`, `test/test-tell-security.js:1-120`, `test/test-tell-context.js:1-75`.
