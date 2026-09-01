import path from 'node:path';

export interface CliArgs {
  /** Resolved absolute working directory for the sandbox. */
  cwd: string;
  /** Optional initial prompt used to pre-seed the first chat message. */
  initialPrompt?: string;
  /** Whether automatic execution of AI-generated commands is enabled. */
  autoExecute: boolean;
  /** Model shortcode or full spec (`-m/--model`). */
  model: string;
  /** Whether to continue after command output until the AI gives a final answer. */
  chain: boolean;
  /** Whether command execution is auto-confirmed (autoExecute on). */
  yes: boolean;
}

function valueOf(argv: string[], ...flags: string[]): string | undefined {
  for (const flag of flags) {
    const i = argv.indexOf(flag);
    if (i >= 0 && argv[i + 1]) return argv[i + 1];
  }
  return undefined;
}

function has(argv: string[], ...flags: string[]): boolean {
  return flags.some((flag) => argv.includes(flag));
}

export function parseCliArgs(argv: string[], defaultCwd: string): CliArgs {
  const argCwd = valueOf(argv, '--cwd');
  const initialPrompt = valueOf(argv, '--prompt');
  const model = valueOf(argv, '-m', '--model') || '';
  const chain = has(argv, '--chain');
  const yes = has(argv, '-y', '--yes');
  const noExec = has(argv, '--no-exec');
  return {
    cwd: path.resolve(argCwd || defaultCwd),
    initialPrompt,
    autoExecute: yes || !noExec,
    model,
    chain,
    yes,
  };
}
