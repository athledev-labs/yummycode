import type { ChatMessage, ChatOptions, LLMProvider, ProviderStatus } from '../types.js';

/** Preference order when auto-selecting an installed model. */
const MODEL_PREFERENCE = [
  'qwen3:14b',
  'qwen3',
  'qwen2.5:14b',
  'qwen2.5:7b',
  'llama3.1:8b',
  'llama3.1',
  'llama3.2',
  'mistral',
  'qwen2.5:3b',
  'qwen2.5',
  'phi3',
  'gemma2',
];

interface OllamaTag {
  name: string;
  model?: string;
}

async function listModels(host: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(`${host}/api/tags`, { signal });
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const data = (await res.json()) as { models?: OllamaTag[] };
  return (data.models ?? []).map((m) => m.name);
}

/** Pick the best installed model given the preference list. */
export function pickModel(installed: string[], requested?: string): string | null {
  if (installed.length === 0) return null;
  if (requested && installed.includes(requested)) return requested;
  if (requested) {
    const loose = installed.find((m) => m.startsWith(requested) || m.startsWith(`${requested}:`));
    if (loose) return loose;
  }
  for (const pref of MODEL_PREFERENCE) {
    const match = installed.find(
      (m) => m === pref || m.startsWith(`${pref}:`) || m.startsWith(pref),
    );
    if (match) return match;
  }
  return installed[0] ?? null;
}

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';
  readonly local = true;
  private resolvedModel: string;

  constructor(
    private readonly host: string,
    model: string | undefined,
    private readonly requestedModel?: string,
  ) {
    this.resolvedModel = model ?? requestedModel ?? 'qwen3:14b';
  }

  get model(): string {
    return this.resolvedModel;
  }

  get label(): string {
    return `Ollama (${this.resolvedModel})`;
  }

  async status(): Promise<ProviderStatus> {
    let installed: string[];
    try {
      installed = await listModels(this.host, AbortSignal.timeout(2500));
    } catch {
      return {
        ok: false,
        detail: `Ollama is not reachable at ${this.host}. Start it with: ollama serve`,
      };
    }
    const chosen = pickModel(installed, this.requestedModel);
    if (!chosen) {
      return {
        ok: false,
        detail: 'Ollama is running but no model is installed. Run: ollama pull qwen3:14b',
      };
    }
    this.resolvedModel = chosen;
    return { ok: true, detail: `Using ${chosen}`, model: chosen };
  }

  private async ensureModel(signal?: AbortSignal): Promise<void> {
    const installed = await listModels(this.host, signal);
    const chosen = pickModel(installed, this.requestedModel);
    if (!chosen) throw new Error('No Ollama model installed. Run: ollama pull qwen3:14b');
    this.resolvedModel = chosen;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    await this.ensureModel(options.signal);
    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        model: this.resolvedModel,
        messages,
        stream: false,
        format: options.json ? 'json' : undefined,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 512,
        },
      }),
    });
    if (!res.ok) throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? '';
  }

  async *stream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    await this.ensureModel(options.signal);
    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        model: this.resolvedModel,
        messages,
        stream: true,
        format: options.json ? 'json' : undefined,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 512,
        },
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const content = json.message?.content;
          if (content) yield content;
        } catch {
          // skip malformed line
        }
      }
    }
  }
}
