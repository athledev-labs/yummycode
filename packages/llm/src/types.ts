export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to return strict JSON when supported. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface ProviderStatus {
  ok: boolean;
  /** Human-readable status or next step, e.g. "No model installed. Run: ollama pull qwen3:14b". */
  detail: string;
  model?: string;
}

export interface LLMProvider {
  /** Stable id, e.g. "ollama", "anthropic", "mock". */
  readonly id: string;
  /** Display label, e.g. "Ollama (qwen2.5:3b)". */
  readonly label: string;
  readonly model: string;
  /** Whether inference is fully local (no network egress). */
  readonly local: boolean;

  status(): Promise<ProviderStatus>;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
}

export type ProviderKind = 'auto' | 'ollama' | 'openai' | 'anthropic' | 'mock';

export interface ProviderConfig {
  kind: ProviderKind;
  model?: string;
  ollamaHost?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
}
