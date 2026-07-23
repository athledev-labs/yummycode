import type { ChatMessage, ChatOptions, LLMProvider, ProviderStatus } from '../types.js';
import { readSSE } from './sse.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Split our flat message list into an Anthropic system string + turns. */
function splitMessages(messages: ChatMessage[]): {
  system: string;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  return { system, turns };
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly local = false;

  constructor(
    private readonly apiKey: string,
    readonly model = 'claude-sonnet-5',
  ) {}

  get label(): string {
    return `Anthropic (${this.model})`;
  }

  async status(): Promise<ProviderStatus> {
    if (!this.apiKey) return { ok: false, detail: 'ANTHROPIC_API_KEY is not set.' };
    return { ok: true, detail: `Using ${this.model} (hosted)`, model: this.model };
  }

  private body(messages: ChatMessage[], options: ChatOptions, stream: boolean): string {
    const { system, turns } = splitMessages(messages);
    return JSON.stringify({
      model: this.model,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      system: system || undefined,
      messages: turns,
      stream,
    });
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
    };
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: this.headers(),
      signal: options.signal,
      body: this.body(messages, options, false),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  }

  async *stream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: this.headers(),
      signal: options.signal,
      body: this.body(messages, options, true),
    });
    if (!res.ok || !res.body) throw new Error(`Anthropic stream error ${res.status}`);
    for await (const payload of readSSE(res.body)) {
      if (payload === '[DONE]') break;
      try {
        const event = JSON.parse(payload) as {
          type: string;
          delta?: { type?: string; text?: string };
        };
        if (event.type === 'content_block_delta' && event.delta?.text) {
          yield event.delta.text;
        }
      } catch {
        // ignore keep-alive / non-JSON payloads
      }
    }
  }
}
