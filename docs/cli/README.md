# CLI documentation

Complete reference for the `tell-ai` package (`packages/cli/`): the `tell` binary.

| Page | Contents |
|------|----------|
| [overview.md](overview.md) | What the CLI is, architecture, invocation lifecycle |
| [cli-reference.md](cli-reference.md) | Flags, positional model, exit codes, examples |
| [context.md](context.md) | `-c` / `--ctx` / `-n` / `-l`, `ContextPlan` state machine, files |
| [execution.md](execution.md) | `<RUN>` flow, confirmation, `-y` / `--no-exec`, timeouts |
| [chain-mode.md](chain-mode.md) | `--chain` loop, feedback, 8-round limit |
| [input-logging.md](input-logging.md) | stdin / `-i`, history logs |
| [env-config.md](env-config.md) | API keys, token files, base URLs, `TELL_MODEL`, system prompt |
| [security.md](security.md) | High-risk catalog, injection policy, test mapping |
| [development.md](development.md) | Build, lint, tests, harness |

## Sources of truth

* Implementation: `packages/cli/src/Tell.ts` (752 lines), `packages/cli/src/env.ts`, `packages/cli/src/systemPrompt.ts`
* Package metadata: `packages/cli/package.json`, `packages/cli/tsup.config.ts`, `packages/cli/tsconfig.json`
* Behavior contracts: `test/test-tell-security.js`, `test/test-tell-context.js`
* Related docs (not duplicated here): `../usage.md` (user guide), `../integrations.md` (git/CI/editors/bots), `../sdk/imports.md` (SDK build variants), `../../packages/cli/README.md` (install + keys quick ref), `../../packages/cli/CHANGELOG_AI.md`

## Conventions used in these pages

* `Tell.ts:<line>` refers to `packages/cli/src/Tell.ts`.
* `env.ts:<line>` refers to `packages/cli/src/env.ts`.
* Constants: `DEFAULT_MODEL`, `MAX_BUFFER`, `EXEC_TIMEOUT`, `STDIN_TIMEOUT`, `MAX_CONTEXT_CHARS`, `MAX_CHAIN_STEPS` are defined in `Tell.ts:23-31`.
* For model aliases, `tell -m --help` is authoritative. The alias table in `../usage.md` is a snapshot and may lag `MODELS` in `packages/sdk/src/models.ts`.
