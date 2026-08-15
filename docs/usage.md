# Usage

## Quick start

```bash
npm install -g tell-ai
tell "explain this directory"
```

## Model selection

The first positional argument is auto-detected as a model alias if it matches a known shortcut. Otherwise use `-m`:

```bash
tell d "run ls -la"           # positional model alias
tell -m d "run ls -la"        # explicit model flag
tell -m deepseek:deepseek-v4-pro:medium "run ls -la"   # full spec
```

### Model aliases

```
Alias  Model
-----  ------------------------------------------------
g--    openai:gpt-5.5:none
g-     openai:gpt-5.5:low
g      openai:gpt-5.5:medium
g+     openai:gpt-5.5:xhigh
G      openai:gpt-5.5:xhigh
p      openai:gpt-5.5-pro:medium
p+     openai:gpt-5.5-pro:high
p++    openai:gpt-5.5-pro:xhigh
P      openai:gpt-5.5-pro:xhigh
s--    anthropic:claude-sonnet-5:none
s-     anthropic:claude-sonnet-5:low
s      anthropic:claude-sonnet-5:medium
s+     anthropic:claude-sonnet-5:high
s++    anthropic:claude-sonnet-5:max
S      anthropic:claude-sonnet-5:high
o--    anthropic:claude-opus-5:none
o-     anthropic:claude-opus-5:low
o      anthropic:claude-opus-5:medium
o+     anthropic:claude-opus-5:high
o++    anthropic:claude-opus-5:max
O      anthropic:claude-opus-5:high
f--    anthropic:claude-fable-5:none
f-     anthropic:claude-fable-5:low
f      anthropic:claude-fable-5:medium
f+     anthropic:claude-fable-5:high
f++    anthropic:claude-fable-5:max
F      anthropic:claude-fable-5:high
i-     google:gemini-3.1-pro-preview:low
i      google:gemini-3.1-pro-preview:medium
i+     google:gemini-3.1-pro-preview:high
I      google:gemini-3.1-pro-preview:high
l-     google:gemini-3.5-flash-lite-preview:low
l      google:gemini-3.5-flash-lite-preview:medium
l+     google:gemini-3.5-flash-lite-preview:high
L      google:gemini-3.5-flash-lite-preview:high
x-     xai:grok-4-0709:low
x      xai:grok-4-0709:medium
X      xai:grok-4-0709:high
d-     deepseek:deepseek-v4-pro:low
d      deepseek:deepseek-v4-pro:medium
d+     deepseek:deepseek-v4-pro:high
D      deepseek:deepseek-v4-pro:high
df-    deepseek:deepseek-v4-flash:low
df     deepseek:deepseek-v4-flash:medium
df+    deepseek:deepseek-v4-flash:high
DF     deepseek:deepseek-v4-flash:high
z--    zai:glm-5.3:none
z-     zai:glm-5.3:low
z      zai:glm-5.3:medium
z+     zai:glm-5.3:high
z++    zai:glm-5.3:max
Z      zai:glm-5.3:high
k      moonshotai:kimi-k2.7-code:none
K      moonshotai:kimi-k3:max
q      local:/root/model:none
v      vast:/root/model:none
```

**Thinking budgets** (suffix): none, low, medium (default), high, xhigh, max.

**Fast mode**: prefix with `.` (e.g. `.g`) to disable reasoning tokens. Append `:fast` to full specs.

Full specs use the format `vendor:model:thinking` (e.g. `openai:gpt-5.5:high`).

List all aliases from the CLI:

```bash
tell -m --help
```

## Command execution

The AI can run bash commands by wrapping them in `<RUN>...</RUN>` tags. By default you confirm each command interactively.

```bash
tell d "run ls -la"        # asks before executing
tell -y d "run ls -la"     # auto-executes (high-risk still requires confirmation)
tell --no-exec d "run ls"  # never executes, shows what would run
```

**High-risk patterns** are always blocked even with `-y`: `sudo`, `rm -rf`, `mkfs`, `dd of=`, `curl|sh`, writes to system paths (`/etc`, `/boot`, `/usr`), crontab manipulation, etc. Commands time out after 120s.

## Piped input (stdin)

```bash
npm run build 2>&1 | tell -i "what should I fix first?"
git diff --staged | tell --input "review this change"
cat error.log | tell "explain this error"
```

Without `-i`, stdin is captured only when no prompt arguments are given:

```bash
echo "explain this" | tell    # stdin becomes the prompt
```

## Chain mode (`--chain`)

The assistant can run commands, see their output, and continue with follow-up commands until it reaches a final answer. Up to 8 command rounds.

```bash
tell --chain "find out why the build is failing and fix it"
npm run build 2>&1 | tell --chain -i "fix the build errors"
```

## Persistent context (`-c`, `--ctx`, `-n`)

Context flags are explicit — no value guessing. Only named contexts are saved:

```bash
tell -c "remember that this project uses PostgreSQL"   # default context for this dir+model
tell --ctx "remember this too"                         # bare/multi-word --ctx = same as -c

tell --ctx myproj "seed the project"                   # use-or-create named: resumes if it exists
tell --ctx myproj "continue the project"               # ...otherwise creates it fresh
tell --ctx myproj -n "start over"                      # explicit reset (always starts empty)

tell -l                                                # list saved contexts
tell --ctx @0 "resume the most recent one"             # recency index (must exist)
tell --ctx '#a1b2c3' "resume by hash prefix"           # explicit # = hash, must exist
```

Context files live at `~/.ai/tell_context/`. Without any context flag, each invocation starts fresh and the default context is cleared. Context is automatically truncated at 200,000 characters.

## Flag interactions

How `-c` (default context) and `--chain` (multi-step loop) combine:

| Flags | Reads context? | Deletes? | Writes? | Loop? |
|-------|--------|---------|--------|------|
| *(none)* | no | yes | no | no |
| `-c` | yes | no | yes (final) | no |
| `--chain` | no | yes | no | yes (8 rounds) |
| `-c --chain` | yes | no | yes (incremental) | yes (8 rounds) |

Without any flag, context is deleted on start (one-shot execution, no history kept).  
`-c` loads the previous conversation and appends the result at the end.  
`--chain` loops up to 8 rounds feeding command outputs to the model, but does not persist context across invocations.  
`-c --chain` reads previous context, loops up to 8 rounds, and writes incrementally — each round's output is appended to the context file.

## Logging

Conversations are logged to `~/.ai/tell_history/` with timestamps.

## Environment variables

| Variable          | Description                    | Default |
|-------------------|--------------------------------|---------|
| `TELL_MODEL`      | Default model alias            | `g`     |
| `DEBUG`           | Enable debug output            | unset   |

## Self-hosted models

```bash
export VAST_BASE_URL="http://..."
tell v "summarize this file"

export LOCAL_OPENAI_BASE_URL="http://localhost:8080/v1"
tell q "explain this code"
```
