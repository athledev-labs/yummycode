# CLAUDE.md

Guidance for working in this repo.

## What this is

yummycode is a local-first technical conversation simulator. It indexes a user's codebase and
lets them practice explaining it to a persona, then produces a structured debrief. It is not a
coding assistant. The persona asks questions and never helps.

## Layout

pnpm workspace monorepo. Build order follows the dependency graph:
`core -> llm -> conversation -> debrief -> server -> cli`, with `web` built separately by Vite.

- `core` scanner + retrieval + shared types. No workspace deps.
- `llm` provider adapters behind `LLMProvider`. `mock` must stay usable offline (demos, CI).
- `conversation` persona system, phase orchestrator, claim/contradiction/grounding logic.
- `debrief` deterministic detectors + one model call for the reference summary.
- `server` Hono app, SSE streaming, session store, static hosting.
- `web` Vite + React. Never import Node-only code; response shapes are mirrored in `web/src/types.ts`.
- `cli` Ink TUI plus a headless path (`-y` or no TTY) that both share `orchestrate.ts`.

## Commands

```bash
pnpm build          # tsc -b for libs, then vite build for web
pnpm test           # builds libs, runs vitest (tests import built dist via @yummycode/*)
pnpm smoke          # full server + session flow with the mock provider
pnpm lint           # eslint
pnpm format         # prettier
```

Run the app: `node packages/cli/dist/index.js <path> [--mock] [--no-open] [--port N]`.

## Conventions

- ESM everywhere. Node packages use `NodeNext`, so relative imports carry `.js` extensions.
- TypeScript strict mode. Keep the conversation engine modular, not a single mega-prompt.
- Product voice: no em dashes, no filler, no hype, no emoji in UI. Terse, professional labels.
- Browser design tokens live in `packages/web/src/styles.css` (SF Pro stack, 12/13/14/24px,
  `#292929`/`#5D5D5D`/`#9E9E9E`, card radius 16, pill CTAs). Match them.
- Nothing leaves the machine unless the user configures a hosted key. Do not add network calls
  that send repository contents anywhere.

## Testing notes

Tests run against built packages, so `pnpm test` builds libs first. The shared fixture lives at
`packages/core/test/fixture`. The mock provider is deterministic; use it for anything that must
pass without a model.
