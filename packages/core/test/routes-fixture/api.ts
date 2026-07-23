import { Hono } from 'hono';

const app = new Hono();

// app.get('/commented-out', handler) should never be detected as a route.
app.get('/real', (c) => c.json({ ok: true }));
app.post('/real', (c) => c.json({ ok: true }));

export default app;
