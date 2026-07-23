# Roadmap

Order of work: get the persona lineup right first, then build outward (voice, deeper indexing,
and the rest). Adding a persona is cheap in this architecture: a `PersonaProfile` in
`packages/conversation/src/persona/profile.ts` plus a `PERSONA_META` entry in
`packages/core/src/personas.ts`. Everything else (orchestrator, grounding, debrief) already
consumes them generically.

## Personas

Personas span two axes: how technical the listener is, and whether they think in product or
engineering terms. A good general set covers both without overlap.

### Shipped (v1)

| Persona          | Audience      | Pushes on                                                                                        |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| Parent or friend | Non-technical | What it actually does, who uses it, what happens when it breaks. Interrupts on any jargon.       |
| Curious PM       | Product       | The problem and the user, scope, the one thing it must get right, risk, how success is measured. |

### Recommended core (build next)

High value and broadly useful. These, with the two above, cover most real audiences.

| Persona                     | Audience        | Pushes on                                                                                                                                            |
| --------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| New teammate                | Technical, new  | The mental model needed to contribute: where things live, how a request flows, what to touch for a given change. Rewards a clear architecture story. |
| Skeptical senior engineer   | Technical peer  | Design choices and tradeoffs, failure modes, "why not the simpler thing," scaling and edge cases. Does not accept hand-waving.                       |
| Executive (CTO or eng lead) | Business + risk | Cost, timeline reality, what could go wrong, strategic fit, what happens if it slips. Redirects deep technical detail to impact and risk.            |

### Specialized (later)

Valuable for specific practice, narrower use.

| Persona                     | Audience      | Pushes on                                                                                                        |
| --------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Interviewer (system design) | Technical     | Constraints, alternatives considered, tradeoffs, rough scale math. Neutral and probing, like a design interview. |
| Investor                    | Business      | Market, why now, moat, defensibility, what breaks the thesis. Impatient with detail that is not differentiation. |
| Skeptical customer          | Non-technical | Only whether it solves their problem: why switch, what it does for them, what the catch is.                      |

### Persona authoring

Before adding the specialized set, extract a small authoring format so a persona is defined as
data (character, tone, constraints, per-phase directives, openers) with no code changes beyond
registration. This keeps the lineup easy to grow and, later, opens the door to a custom persona
builder (out of scope for now).

## Beyond personas

Phased so each stage ships something usable.

### Phase B: Voice

The turn manager and streaming pipeline are already voice-ready. Add speech to text on the way
in and text to speech on the way out, with push to talk in the browser. No change to the
conversation engine, only new edges on the server and web app.

### Phase C: Deeper indexing

- Monorepo-aware entry points (packages/\*/src, bin fields, framework conventions), not just
  top-level conventional names.
- More route frameworks: Next.js and Nest.js, Django and Flask, Rails, Spring.
- Optional local embeddings retrieval as an upgrade over lexical grounding, still fully on device.
- Skip source examples in comments so self-scans stop reporting phantom routes.

### Phase D: Smarter conversation

- Optional LLM pass for claim and contradiction extraction to complement the heuristics.
- Topic tracking so grounding follows the thread instead of only the last message.
- Configurable turn limits and escalation intensity per persona.

### Phase E: Richer debrief

- Trend across sessions for the same project.
- Per-audience scoring history.
- Export a debrief to markdown or share it.

### Phase F: Persistence and packaging

- Session history and resume.
- Publish to npm so `npx yummycode` works with a one-line install.

## Out of scope (still)

Auth, billing, teams, cloud sync, and diagrams remain out of scope until the single-user local
loop is excellent.
