#!/usr/bin/env node
// End-to-end smoke test: build must exist, server must boot, and a full
// session (create -> message -> debrief) must succeed with the mock provider.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8799;
const base = `http://127.0.0.1:${port}`;
const fixture = path.join(root, 'packages', 'core', 'test', 'fixture');

function assert(cond, message) {
  if (!cond) throw new Error(`Assertion failed: ${message}`);
  process.stdout.write(`  ok  ${message}\n`);
}

async function readSSE(res) {
  const text = await res.text();
  const events = {};
  for (const frame of text.split('\n\n')) {
    const lines = frame.split('\n');
    const event = lines
      .find((l) => l.startsWith('event:'))
      ?.slice(6)
      .trim();
    const data = lines
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n');
    if (event) (events[event] ??= []).push(data);
  }
  return events;
}

const child = spawn(
  'node',
  [
    path.join('packages', 'cli', 'dist', 'index.js'),
    '--project',
    fixture,
    '--mock',
    '--no-open',
    '--port',
    String(port),
    '-y',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);

let serverLog = '';
child.stdout.on('data', (d) => (serverLog += d));
child.stderr.on('data', (d) => (serverLog += d));

async function main() {
  process.stdout.write('yummycode smoke test\n');

  // Wait for the server to accept requests.
  let up = false;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        up = true;
        break;
      }
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  assert(up, 'server responds on /api/health');

  const health = await (await fetch(`${base}/api/health`)).json();
  assert(health.ok === true, 'health reports ok');
  assert(health.provider.id === 'mock', 'mock provider active');

  const index = await (await fetch(`${base}/api/index`)).json();
  assert(index.name === 'acme-todos', 'index name is acme-todos');
  assert(index.routes.length > 0, 'routes were detected');

  const created = await (
    await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ persona: 'friend' }),
    })
  ).json();
  const sid = created.session.id;
  assert(Boolean(sid), 'session created');
  assert(created.session.turns.length === 1, 'session opens with a persona turn');

  const msgRes = await fetch(`${base}/api/sessions/${sid}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'It is an API that stores todos in a database.' }),
  });
  const events = await readSSE(msgRes);
  assert(Boolean(events.token?.length), 'persona response streamed tokens');
  assert(Boolean(events.done?.length), 'stream completed with a done event');

  await fetch(`${base}/api/sessions/${sid}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'In one sentence, it is a shared todo service.' }),
  });

  const debrief = (
    await (await fetch(`${base}/api/sessions/${sid}/debrief`, { method: 'POST' })).json()
  ).debrief;
  assert(debrief.studyPlan.length === 3, 'debrief has a 3-item study plan');
  assert(
    typeof debrief.clearSummary === 'string' && debrief.clearSummary.length > 10,
    'debrief has a clear summary',
  );
  assert(
    debrief.jargon.some((j) => j.term === 'api'),
    'debrief flagged api jargon',
  );

  process.stdout.write('\nSMOKE PASSED\n');
}

main()
  .then(() => {
    child.kill('SIGTERM');
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(`\nSMOKE FAILED: ${err.message}\n`);
    process.stderr.write(`--- server log ---\n${serverLog}\n`);
    child.kill('SIGTERM');
    process.exit(1);
  });
