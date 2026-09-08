import { generateText } from 'ai';
import type { SDKConfig } from './config';
import { get_model } from './models';

export interface AskInstance {
  ask(message: string, options: { system: string; stream: false }): Promise<string>;
}

export async function create_ask_ai(modelSpec: string, config: SDKConfig): Promise<AskInstance> {
  const handle = await get_model(modelSpec, config);
  const reasoning = handle.fast ? 'none' : handle.reasoning;

  return {
    ask: async (message: string, options: { system: string; stream: false }) => {
      const gen_options: any = {
        model: handle.model,
        instructions: options.system,
        prompt: message,
        reasoning,
      };
      const result = await generateText(gen_options);
      const model_reasoning = result.finalStep.reasoningText;
      return model_reasoning ? `<think>${model_reasoning}</think>\n${result.text}` : result.text;
    },
  };
}
