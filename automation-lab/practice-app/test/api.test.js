import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';

const servers = [];
async function start({ dataDir, labMode = false } = {}) {
  const dir = dataDir || await fs.mkdtemp(path.join(os.tmpdir(), 'academy-help-desk-'));
  const app = createApp({ dataDir: dir, labMode, distDir: path.join(dir, 'dist') });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  servers.push(app);
  return { dir, base: `http://127.0.0.1:${app.address().port}` };
}
async function request(base, route, options) { const response = await fetch(`${base}${route}`, options); return { response, body: await response.json() }; }
const ticket = index => ({ title: `Login issue ${index}`, student: `Student ${index}`, description: `A reproducible practice issue ${index}.` });
afterEach(async () => { while (servers.length) await new Promise(resolve => servers.pop().close(resolve)); });

test('creates tickets atomically under concurrent requests and persists them', async () => {
  const first = await start();
  const created = await Promise.all(Array.from({ length: 20 }, (_, index) => request(first.base, '/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ticket(index)) })));
  assert.ok(created.every(result => result.response.status === 201 && result.body.ticket.status === 'open'));
  const list = await request(first.base, '/api/tickets');
  assert.equal(list.body.tickets.length, 23);
  await new Promise(resolve => servers.pop().close(resolve));
  const restarted = await start({ dataDir: first.dir });
  const afterRestart = await request(restarted.base, '/api/tickets');
  assert.equal(afterRestart.body.tickets.length, 23);
});

test('separates data directories and exposes reset only in lab mode', async () => {
  const one = await start({ labMode: true }); const two = await start({ labMode: true });
  await request(one.base, '/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ticket('private')) });
  assert.equal((await request(one.base, '/api/tickets')).body.tickets.length, 4);
  assert.equal((await request(two.base, '/api/tickets')).body.tickets.length, 3);
  assert.equal((await request(one.base, '/api/test/reset', { method: 'POST' })).response.status, 200);
  assert.equal((await request(one.base, '/api/tickets')).body.tickets.length, 3);
  const restricted = await start();
  assert.equal((await request(restricted.base, '/api/test/reset', { method: 'POST' })).response.status, 404);
});

test('rejects invalid input, forces new tickets open, filters and updates valid tickets', async () => {
  const app = await start();
  const invalid = await request(app.base, '/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x' }) });
  assert.equal(invalid.response.status, 400);
  const overridden = await request(app.base, '/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...ticket('status'), status: 'resolved' }) });
  assert.equal(overridden.response.status, 400);
  const created = await request(app.base, '/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ticket('searchable')) });
  const filtered = await request(app.base, '/api/tickets?status=open&q=searchable');
  assert.equal(filtered.body.tickets[0].id, created.body.ticket.id);
  const update = await request(app.base, `/api/tickets/${created.body.ticket.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
  assert.equal(update.body.ticket.status, 'resolved');
  assert.equal((await request(app.base, '/api/health')).body.labMode, false);
});

// TEST ONLY: this branch is a release-gate failure rehearsal and must never merge.
test('TEST ONLY: deliberately wrong healthy API status blocks release packaging', async () => {
  const app = await start();
  const result = await request(app.base, '/api/health');
  assert.equal(result.response.status, 503, 'Deliberate failure: the healthy API returns 200');
});
