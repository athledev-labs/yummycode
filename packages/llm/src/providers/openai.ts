import type { ChatMessage, ChatOptions, LLMProvider, ProviderStatus } from '../types.js';
import { readSSE } from './sse.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly local = false;

  constructor(
    private readonly apiKey: string,
    readonly model = 'gpt-4o-mini',
  ) {}

  get label(): string {
    return `OpenAI (${this.model})`;
  }

  async status(): Promise<ProviderStatus> {
    if (!this.apiKey) return { ok: false, detail: 'OPENAI_API_KEY is not set.' };
    return { ok: true, detail: `Using ${this.model} (hosted)`, model: this.model };
  }

  private body(messages: ChatMessage[], options: ChatOptions, stream: boolean): string {
    return JSON.stringify({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      stream,
      response_format: options.json ? { type: 'json_object' } : undefined,
    });
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: this.headers(),
      signal: options.signal,
      body: this.body(messages, options, false),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  async *stream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: this.headers(),
      signal: options.signal,
      body: this.body(messages, options, true),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI stream error ${res.status}`);
    for await (const payload of readSSE(res.body)) {
      if (payload === '[DONE]') break;
      try {
        const event = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = event.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore
      }
    }
  }
}
