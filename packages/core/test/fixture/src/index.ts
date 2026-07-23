import { Hono } from 'hono';

const app = new Hono();

app.get('/todos', (c) => c.json({ todos: [] }));
app.post('/todos', (c) => c.json({ ok: true }));
app.delete('/todos/:id', (c) => c.json({ ok: true }));

export default app;
