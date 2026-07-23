# Roadmap

Adding a persona is cheap in this architecture: a `PersonaProfile` in
`packages/conversation/src/persona/profile.ts` plus a `PERSONA_META` entry in
`packages/core/src/personas.ts`. Everything else (orchestrator, grounding, debrief) already
consumes them generically.

## Shipped

The full persona lineup and the first wave of enhancements are in.

- Eight personas across four audience classes (see below).
- Audience-class scoring, so the debrief judges fit differently per listener.
- Voice: browser speech synthesis (persona speaks) and recognition (push to talk), with a text
  fallback when the APIs are missing.
- Deeper indexing: route detection for Express, Hono, Fastify, FastAPI, Flask, NestJS, Spring,
  Rails, Django, and Next.js app-router files, comment lines skipped so example calls are not
  counted, and monorepo-aware entry points (workspace packages plus package.json main and bin).
- Debrief export as Markdown (copy or download).
- Session persistence under the project's `.yummycode/sessions`, with resume across restarts.

## Personas

Personas span two axes: how technical the listener is, and whether they think in product or
engineering terms.

| Persona                     | Audience        | Pushes on                                                          |
| --------------------------- | --------------- | ------------------------------------------------------------------ |
| Parent or friend            | Non-technical   | What it does, who uses it, what happens when it breaks.            |
| Skeptical customer          | Non-technical   | Why switch, what it does for me, what the catch is.                |
| Curious PM                  | Product         | The problem and user, scope, the one thing it must nail.           |
| Executive                   | Business + risk | Cost, timeline reality, risk, strategic fit.                       |
| Investor                    | Business        | Market, why now, moat, what breaks the thesis.                     |
| New teammate                | Technical, new  | The mental model to contribute: where things live, how data flows. |
| Skeptical senior engineer   | Technical peer  | Design choices, tradeoffs, failure modes. No hand-waving.          |
| Interviewer (system design) | Technical       | Constraints, alternatives, tradeoffs, rough scale.                 |

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
