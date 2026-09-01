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
s--    anthropic:claude-sonnet-4-6:none
s-     anthropic:claude-sonnet-4-6:low
s      anthropic:claude-sonnet-4-6:medium
s+     anthropic:claude-sonnet-4-6:high
s++    anthropic:claude-sonnet-4-6:max
S      anthropic:claude-sonnet-4-6:high
o--    anthropic:claude-opus-4-8:none
o-     anthropic:claude-opus-4-8:low
o      anthropic:claude-opus-4-8:medium
o+     anthropic:claude-opus-4-8:high
o++    anthropic:claude-opus-4-8:max
O      anthropic:claude-opus-4-8:high
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
l-     google:gemini-3.1-flash-lite-preview:low
l      google:gemini-3.1-flash-lite-preview:medium
l+     google:gemini-3.1-flash-lite-preview:high
L      google:gemini-3.1-flash-lite-preview:high
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
z--    fireworks:glm-5p2:none
z-     fireworks:glm-5p2:low
z      fireworks:glm-5p2:medium
z+     fireworks:glm-5p2:high
z++    fireworks:glm-5p2:max
Z      fireworks:glm-5p2:high
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

## Persistent context (`-c`)

Keep conversation history across invocations per directory and model. Stored at `~/.ai/tell_context/`.

```bash
tell -c "remember that this project uses PostgreSQL"
tell -c "now add a users table migration"   # remembers the previous message
```

Without `-c`, each invocation starts fresh. Context is automatically truncated at 200,000 characters.

## Flag interactions

How `-c` (persistent context) and `--chain` (multi-step loop) combine:

| Flags | Reads context? | Deletes? | Writes? | Loop? |
|-------|--------|---------|--------|------|
| *(none)* | no | yes | no | no |
| `-c` | yes | no | yes (final) | no |
| `--chain` | no | yes | no | yes (8 rounds) |
| `-c --chain` | yes | no | yes (incremental) | yes (8 rounds) |

Without any flag, context is deleted on start (one-shot execution, no history kept).  
`-c` loads previous conversation and appends the result at the end.  
`--chain` loops up to 8 rounds feeding command outputs to the model, but does not persist context across invocations.  
`-c --chain` reads previous context, loops up to 8 rounds, and writes incrementally — each round's output is appended to the context file.

## Web sandbox (`-w` / `--web`)

Launch the interactive Tell Web sandbox in your browser:

```bash
tell --web                       # open the sandbox at http://localhost:3000
tell -w --cwd /path/to/project   # run in another working directory (created if missing)
tell -w --no-exec "ola"          # start the chat pre-seeded with "ola", auto-execution off
```

Options:

- `--cwd <path>` — working directory for the sandbox. If it does not exist it is created
  and a warning is shown. Defaults to the current working directory.
- A trailing prompt (e.g. `"ola"`) pre-seeds the first chat message.
- `--no-exec` — disables automatic execution of AI-generated commands in the sandbox.

The web server runs in the selected working directory. If the `tell-web` binary is
not installed, install it with `npm install -g @tell-ai/web`.

> Full guide with deployment scenarios, real-world examples and security notes:
> [Web Sandbox](web-sandbox.md).

### Auto-generated system prompt

The sandbox generates a persistent system prompt from the project itself:

- Directory tree up to 4 levels deep (skipping `node_modules`, `.git`, `dist`, `.env`, `.tell`)
- `README.md` contents if present
- `AGENTS.md` / `agent.md` contents if present
- Platform, working directory, timestamp, and the `<RUN>` execution protocol

You can still edit the prompt in the Settings panel; "Reset" restores the generated one.

### Console Interface (real PTY)

Each pane is a real pseudo-terminal (`node-pty` + WebSocket + xterm.js). Commands run
in a persistent interactive bash session with a real TTY, so `tmux`, `vim`, `htop`,
`codex`, `opencode`, `claude-code`, and `tell-ai` work as in your local shell.
Tabs and splits support up to 4 tabs / 4 panes each.

### Session persistence (`.tell/`)

The sandbox auto-saves its state to a hidden `.tell/` directory in the project root:

```
.tell/session.json                 # current state (atomic write, debounced)
.tell/history/<timestamp>.json     # snapshots
.tell/latest -> history/...        # symlink to most recent snapshot
```

Restored on the next visit: chat messages, system prompt, selected model, terminal
tabs/panes and scrollback. The server also tracks `keysUsed` (provider names only —
**never the key values**), `filesChanged` (editor saves + `git status`), and usage
stats. "Snapshot Now" in the Settings panel forces a snapshot.

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
