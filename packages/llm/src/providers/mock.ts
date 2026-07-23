import type { ChatMessage, ChatOptions, LLMProvider, ProviderStatus } from '../types.js';

/**
 * A dependency-free, offline provider. It is not a language model; it inspects
 * the conversation and produces plausible, in-character persona questions plus
 * valid JSON for structured passes. Good enough to demo the full loop and to
 * run in CI without Ollama or any API key.
 */

const JARGON = [
  'api',
  'endpoint',
  'backend',
  'frontend',
  'framework',
  'database',
  'schema',
  'cache',
  'queue',
  'async',
  'websocket',
  'middleware',
  'orchestrator',
  'pipeline',
  'runtime',
  'latency',
  'throughput',
  'index',
  'embedding',
  'vector',
  'token',
  'stateless',
  'idempotent',
  'kubernetes',
  'docker',
  'microservice',
  'serverless',
  'graphql',
  'rest',
  'oauth',
  'jwt',
  'webhook',
  'cdn',
  'load balancer',
];

type AudienceClass = 'nontechnical' | 'product' | 'technical' | 'business';

const OPENERS: Record<AudienceClass, string[]> = {
  nontechnical: [
    'Okay so, in plain words, what does it actually do?',
    'Wait, back up. Who uses this and why would they need it?',
    'Is this like an app on my phone, or something else?',
  ],
  product: [
    'What problem does this solve, and for whom?',
    'Walk me through the core user journey in one or two sentences.',
    'What is the one thing this has to get right to be worth building?',
  ],
  technical: [
    'Give me the shape of the design. What are the main pieces?',
    'Walk me through how a request flows through this.',
    'What is the core architecture, and what did you trade off to get it?',
  ],
  business: [
    'In one line, why does this matter?',
    'What is the outcome here, and what does it cost to get there?',
    'What is the thesis. Why this, why now?',
  ],
};

const JARGON_PUSH: Record<AudienceClass, string[]> = {
  nontechnical: [
    'You said "{term}". I have no idea what that is. What is it, like I am five?',
    'What is a "{term}"? Pretend I have never heard the word.',
    'Hold on, "{term}" means nothing to me. Can you say that without the computer words?',
  ],
  product: [
    'You mentioned "{term}". What does that buy the user in practice?',
    'Help me connect "{term}" to something the user actually feels.',
    'Set the "{term}" detail aside. What is the user impact?',
  ],
  technical: [
    'You reached for "{term}". What was the tradeoff there?',
    'Why "{term}" and not the more standard approach?',
    'Where does "{term}" break down under load?',
  ],
  business: [
    'Set the "{term}" detail aside. What is the business impact?',
    'What does "{term}" cost us, in time or money?',
    'Pull that up a level. What does "{term}" mean for the outcome?',
  ],
};

const PROBES: Record<AudienceClass, string[]> = {
  nontechnical: [
    'But what happens if it breaks while someone is using it?',
    'So who is this for, exactly? Give me a real person.',
    'And how is this different from just doing it the normal way?',
    'Earlier you said something different. Which one is it?',
    'Okay but why did you build it that way instead of the simple way?',
  ],
  product: [
    'What is the biggest risk here, and how likely is it?',
    'If you had to cut scope by half, what stays?',
    'How would you know this is working after launch?',
    'That contradicts what you said a moment ago. Which is right?',
    'What is the timeline reality, not the optimistic version?',
  ],
  technical: [
    'What breaks first when this is under load?',
    'Why this design and not the obvious simpler one?',
    'Walk me through a concrete failure mode.',
    'What is the nastiest edge case you had to handle?',
    'If you rebuilt it today, what would you change?',
  ],
  business: [
    'What is the biggest risk, and what happens if the timeline slips?',
    'Who actually pays for this, and why now?',
    'What stops a competitor from copying it?',
    'What has to be true for this to be worth it?',
    'Give me the one-sentence version for the board.',
  ],
};

function stableIndex(seed: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum = (sum + seed.charCodeAt(i)) % 100003;
  return length > 0 ? sum % length : 0;
}

function findJargon(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of JARGON) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) {
      return term;
    }
  }
  return null;
}

function detectClass(system: string): AudienceClass {
  const s = system.toLowerCase();
  if (s.includes('you understand code')) return 'technical';
  if (s.includes('do not care about implementation')) return 'business';
  if (s.includes('no technical background')) return 'nontechnical';
  return 'product';
}

function personaReply(messages: ChatMessage[]): string {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const audience = detectClass(system);
  const userTurns = messages.filter((m) => m.role === 'user');
  const assistantTurns = messages.filter((m) => m.role === 'assistant');
  const lastUser = userTurns[userTurns.length - 1]?.content ?? '';
  const turnCount = assistantTurns.length;

  const openers = OPENERS[audience];
  const jargonPush = JARGON_PUSH[audience];
  const probes = PROBES[audience];

  if (turnCount === 0 || lastUser.trim().length === 0) {
    return openers[stableIndex(lastUser || 'open', openers.length)]!;
  }

  const jargon = findJargon(lastUser);
  if (jargon && turnCount % 2 === 1) {
    const template = jargonPush[stableIndex(lastUser + jargon, jargonPush.length)]!;
    return template.replace('{term}', jargon);
  }

  return probes[stableIndex(lastUser + String(turnCount), probes.length)]!;
}

/** Detect and answer the debrief's "one clear sentence" summary request. */
function summaryReply(messages: ChatMessage[]): string | null {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages[messages.length - 1]?.content ?? '';
  if (!/one clear sentence/i.test(system) && !/summarize this software project/i.test(user)) {
    return null;
  }
  const name = user.match(/Name:\s*(.+)/)?.[1]?.trim();
  const desc = user.match(/Description:\s*(.+)/)?.[1]?.trim();
  const langs = user.match(/Languages:\s*(.+)/)?.[1]?.trim();
  if (name && desc) return `${name} is ${lowerFirst(stripPeriod(desc))}.`;
  if (name && langs) return `${name} is a ${langs.split(',')[0]?.trim()} project.`;
  return name ? `${name} is a software project.` : null;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function stripPeriod(s: string): string {
  return s.replace(/\.$/, '');
}

/** Produce a small valid JSON object when a structured pass asks for one. */
function jsonReply(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1]?.content.toLowerCase() ?? '';
  if (last.includes('summary')) {
    return JSON.stringify({
      summary: 'A local tool that indexes your project and lets you practice explaining it.',
    });
  }
  return JSON.stringify({ items: [] });
}

export class MockProvider implements LLMProvider {
  readonly id = 'mock';
  readonly label = 'Mock (offline)';
  readonly model = 'mock';
  readonly local = true;

  async status(): Promise<ProviderStatus> {
    return { ok: true, detail: 'Offline mock provider. No model required.', model: 'mock' };
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    if (options.json) return jsonReply(messages);
    return summaryReply(messages) ?? personaReply(messages);
  }

  async *stream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const text = await this.chat(messages, options);
    // Emit word by word so the UI streaming path is exercised.
    const words = text.split(/(\s+)/);
    for (const word of words) {
      if (options.signal?.aborted) return;
      yield word;
    }
  }
}
