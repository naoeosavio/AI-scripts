# Chain mode (`--chain`)

Without `--chain`, the CLI runs at most one command round: execute the requested scripts, then print the visible text or ask once for a final answer. With `--chain`, it loops — run commands, feed output back, repeat — until the model answers without `<RUN>` tags or the 8-round limit is hit.

```bash
tell --chain "find out why the build is failing and fix it"
npm run build 2>&1 | tell --chain -i "fix the build errors"
tell -c --chain "migrate the schema, then verify"   # + persistent context
```

## Loop (`run_response_loop`, `Tell.ts:594-628`)

State: `ConversationState` (`Tell.ts:61-70`) — `firstPrompt`, `timeline[]`, `commandRounds`, `chainLimitReached`, `autoContinue (= --chain)`, `execEnabled`, `yes`, `saveContext`.

```
response = tell_silently(firstPrompt, { chain: autoContinue })
loop:
  remember_assistant + maybe save_incremental_context
  response = strip_think_tags(response)
  { scripts, visible } = extract_runs(response)
  if scripts.length == 0 or chainLimitReached:
    finish_round (print visible; warn if limit) ; break
  { text, failed } = run_scripts(scripts, yes, execEnabled, log)
  remember_command_result(text) + maybe save_incremental_context
  if not autoContinue:
    handle_final_answer(visible) ; break
  remember_command_round (++commandRounds; limit = >= 8)
  response = tell_silently(build_feedback(state, failed), { chain: true })
```

The first call uses `{ chain: autoContinue }` so the system prompt advertises multi-step behavior only in chain mode; follow-ups always use `{ chain: true }`. The system prompt itself comes from `get_system_prompt({ chain, cwd, platform })` (`src/systemPrompt.ts:6-12`).

## Feedback and termination

* `conversation_text` = `timeline.join('\n')` (`Tell.ts:510-512`).
* `continuation_instruction` (`Tell.ts:514-519`): at limit → `The chain limit of 8 command rounds has been reached. Answer now without <RUN> tags.`; otherwise → `Request another command with <RUN> tags if needed; otherwise answer without <RUN> tags.`
* `build_feedback` (`Tell.ts:589-592`): `strip_think_tags(conversation) + instruction`, prefixed with a failure-analysis directive when the previous round failed. Chain therefore sees the full conversation, not just the last output.
* `should_finish` (`Tell.ts:563-565`): stop when no scripts or `chainLimitReached`.
* `finish_round` (`Tell.ts:567-574`): warn `Chain limit reached (8); ignoring further requested commands.` when capped, print `visible` if any.
* `handle_final_answer` (`Tell.ts:576-587`, non-chain only): print `visible` if present; else one extra `tell_silently(conversation, { chain: false })` with run+think tags stripped. Guarantees a visible answer even when the model only emitted commands.
* `remember_command_round` (`Tell.ts:555-561`): increments after each executed round in chain mode and warns `Chain limit reached (8); asking for final answer.` exactly when the 8th round completes. The next model response is then forced into a final answer (`continuation_instruction` at-limit branch); any `<RUN>` it still emits is ignored by `should_finish`.

## Context interplay

Chain alone does not persist across invocations (`saveContext = false` without `-c`/`--ctx`). `-c --chain` reads previous context once, then `save_incremental_context` overwrites the file after the assistant turn and after every command round — full-timeline recompute, so each round is stored exactly once. Final AI summarization via `maybe_summarize_context` applies on top when over budget. See [context.md](context.md).

## Failure-aware example

1. `tell --chain "fix the build"` → `<RUN>npm run build</RUN>` → exit 2, TS errors.
2. Feedback: `Command failed (exit code 2): … + The command above FAILED… + full conversation + Request another command…`.
3. Model replies `<RUN>…fix…</RUN>` + repeats until clean, then a final answer without tags.

Timeouts still apply per command (120s). A hanging command reports exit 124 and the loop continues with that output as context.

Sources: `Tell.ts:510-520`, `Tell.ts:546-653`; chain assertions in `test/test-tell-security.js:278-313`.
