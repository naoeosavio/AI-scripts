import * as os from 'node:os';
import { get_system_prompt as sdk_get_system_prompt } from '@tell-ai/sdk';

export type PromptOptions = { chain?: boolean };

export function get_system_prompt(options: PromptOptions = {}): string {
  return sdk_get_system_prompt({
    ...(options.chain !== undefined ? { chain: options.chain } : {}),
    cwd: process.cwd(),
    platform: `${os.platform()} ${os.release()}`,
  });
}
