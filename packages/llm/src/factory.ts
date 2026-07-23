import { AnthropicProvider } from './providers/anthropic.js';
import { MockProvider } from './providers/mock.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';
import type { LLMProvider, ProviderConfig } from './types.js';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

/**
 * Build a provider from explicit config. `auto` prefers a configured hosted key,
 * then a local Ollama model, and never silently falls back to mock unless asked.
 */
export async function createProvider(config: ProviderConfig): Promise<LLMProvider> {
  const anthropicKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  const openaiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '';
  const ollamaHost = config.ollamaHost ?? process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_HOST;

  switch (config.kind) {
    case 'mock':
      return new MockProvider();
    case 'anthropic':
      return new AnthropicProvider(
        anthropicKey,
        config.model ?? process.env.YUMMYCODE_ANTHROPIC_MODEL,
      );
    case 'openai':
      return new OpenAIProvider(openaiKey, config.model ?? process.env.YUMMYCODE_OPENAI_MODEL);
    case 'ollama':
      return new OllamaProvider(
        ollamaHost,
        undefined,
        config.model ?? process.env.YUMMYCODE_OLLAMA_MODEL,
      );
    case 'auto':
    default:
      return autoProvider({ anthropicKey, openaiKey, ollamaHost, model: config.model });
  }
}

async function autoProvider(args: {
  anthropicKey: string;
  openaiKey: string;
  ollamaHost: string;
  model?: string;
}): Promise<LLMProvider> {
  if (args.anthropicKey) {
    return new AnthropicProvider(
      args.anthropicKey,
      args.model ?? process.env.YUMMYCODE_ANTHROPIC_MODEL,
    );
  }
  if (args.openaiKey) {
    return new OpenAIProvider(args.openaiKey, args.model ?? process.env.YUMMYCODE_OPENAI_MODEL);
  }
  const ollama = new OllamaProvider(
    args.ollamaHost,
    undefined,
    args.model ?? process.env.YUMMYCODE_OLLAMA_MODEL,
  );
  const status = await ollama.status();
  if (status.ok) return ollama;
  // Return Ollama anyway so the caller can surface its actionable status detail.
  return ollama;
}

export function providerFromModelString(model: string | undefined): ProviderConfig {
  return { kind: 'auto', model };
}
