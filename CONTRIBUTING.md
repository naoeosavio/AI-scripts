# Contributing to tell-ai

Thanks for helping improve tell-ai. This repo is a bun monorepo with three packages: `tell-ai` (CLI), `@tell-ai/sdk` (browser-safe library), and `@tell-ai/web` (sandbox server).

## Quick start

```bash
bun install
bun run build
bun run lint
bun run check
bun run test
```

Per-package commands use filters, e.g. `bun run --filter @tell-ai/web build`. Formatting/linting is Biome v2.2.6 (`biome.json`): single quotes, 2-space indent, 120-char lines.

## Pull requests

1. Fork, branch from `main` (`feat/...`, `fix/...`).
2. Keep changes focused; add or update tests under `test/` where it applies.
3. Run before pushing: `bun run build && bun run lint && bun run check && bun run test`.
4. Describe what changed and how you verified it. Link related issues.
5. Sign off your commits (DCO): `git commit -s -m "feat: ..."`. By signing off you certify the [Developer Certificate of Origin](https://developercertificate.org/) (you wrote the change or have the right to submit it).

## Licenses (inbound = outbound)

Contributions are accepted under the license of the package they touch — no CLA, no copyright transfer:

| Code you touch | License your contribution enters under |
|---|---|
| `packages/cli/`, `packages/web/`, root docs/tests | GPL-3.0 (`LICENSE`) |
| `packages/sdk/` | MIT (`packages/sdk/LICENSE`) |

GPL-3.0 requires modified distributed versions to share source under the same terms, so improvements flow back to the community. If you cannot agree to that, limit your change to `packages/sdk/`.

## Do not commit

`.env*` (except `.env.example`), `.tell/`, `dist/`, `node_modules/`, `*.key`, `*.pem`, editor/OS artifacts. Never commit API keys or tokens.

## Reporting security issues

Command-execution and prompt-injection guards are load-bearing (`isHighRiskScript`). Do not open a public issue for a bypass — contact the maintainer privately with a repro, expected vs actual behavior, and package version.
