# Roadmap

Adding a persona is cheap in this architecture: a `PersonaProfile` in
`packages/conversation/src/persona/profile.ts` plus a `PERSONA_META` entry in
`packages/core/src/personas.ts`. Everything else (orchestrator, grounding, debrief) already
consumes them generically.

## Shipped

The full persona lineup and the first wave of enhancements are in.

- Four general personas, one per audience class (see below), defined as editable data.
- A guided, typography-led home that leads with the project and reveals the start once you pick
  an audience.
- Audience-class scoring, so the debrief judges fit differently per listener.
- Voice: browser speech synthesis (persona speaks) and recognition (push to talk), with a text
  fallback when the APIs are missing.
- Deeper indexing: route detection for Express, Hono, Fastify, FastAPI, Flask, NestJS, Spring,
  Rails, Django, and Next.js app-router files, comment lines skipped so example calls are not
  counted, and monorepo-aware entry points (workspace packages plus package.json main and bin).
- Debrief export as Markdown (copy or download).
- Session persistence under the project's `.yummycode/sessions`, with resume across restarts.

## Personas

Four general archetypes, one per audience class. Kept broad on purpose so they read as templates,
not job titles, and each is plain data that a user could tune or extend.

| Persona           | Audience      | Pushes on                                               |
| ----------------- | ------------- | ------------------------------------------------------- |
| A friend          | Non-technical | What it does, who uses it, what happens when it breaks. |
| A product manager | Product       | Users, scope, the one thing it must get right, risk.    |
| A business leader | Business      | Value, cost, timeline reality, and risk.                |
| A fellow engineer | Technical     | Design, tradeoffs, failure modes, what breaks at scale. |

## Next

Ordered roughly by value.

### Persona authoring

Extract a small data-only authoring format (character, tone, constraints, per-phase directives,
openers) so a persona needs no code beyond registration. This opens the door to a custom persona
builder later.

### Deeper retrieval

Optional local embeddings retrieval as an upgrade over lexical grounding, still fully on device.
Better topic tracking so grounding follows the thread rather than only the last message.

### Smarter conversation

An optional LLM pass for claim and contradiction extraction to complement the heuristics.
Configurable turn limits and escalation intensity per persona.

### Session history

A browser view over saved sessions: revisit past debriefs and track scores over time for the
same project.

### Packaging

Publish to npm so `npx yummycode` works with a one-line install. This needs the workspace CLI
bundled with its dependencies so it runs standalone outside the monorepo.

## Out of scope (still)

Auth, billing, teams, cloud sync, and diagrams remain out of scope until the single-user local
loop is excellent.
