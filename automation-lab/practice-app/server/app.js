import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStore, statuses } from './store.js';

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const error = (res, status, message) => json(res, status, { error: message });
const text = value => typeof value === 'string' ? value.trim() : '';
function validate(input, partial = false, allowStatus = true) {
  if (!input || Array.isArray(input) || typeof input !== 'object') return 'A JSON object is required.';
  const allowed = allowStatus ? ['title', 'student', 'description', 'status'] : ['title', 'student', 'description'];
  if (Object.keys(input).some(key => !allowed.includes(key))) return 'Unexpected field.';
  if (!partial && (!input.title || !input.student || !input.description)) return 'Title, student, and description are required.';
  for (const key of ['title', 'student', 'description']) if (key in input && (typeof input[key] !== 'string' || text(input[key]).length < 3 || text(input[key]).length > (key === 'description' ? 500 : 120))) return `${key} must be 3-${key === 'description' ? 500 : 120} characters.`;
  if ('status' in input && !statuses.includes(input.status)) return `status must be one of: ${statuses.join(', ')}.`;
  return null;
}
async function body(req) { let raw = ''; for await (const part of req) { raw += part; if (raw.length > 20000) throw new Error('Request body is too large.'); } try { return JSON.parse(raw); } catch { throw new Error('Invalid JSON.'); } }
export function createApp({ dataDir, distDir = path.resolve('dist'), labMode = process.env.LAB_MODE === 'true' } = {}) {
  const store = createStore(dataDir || path.resolve('data'));
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'); const { pathname } = url;
    try {
      if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'academy-help-desk', labMode });
      if (req.method === 'GET' && pathname === '/api/tickets') { let tickets = await store.read(); const status = url.searchParams.get('status'); const q = text(url.searchParams.get('q') || '').toLowerCase(); if (status && !statuses.includes(status)) return error(res, 400, 'Unknown status filter.'); if (status) tickets = tickets.filter(t => t.status === status); if (q) tickets = tickets.filter(t => `${t.id} ${t.title} ${t.student} ${t.description}`.toLowerCase().includes(q)); return json(res, 200, { tickets }); }
      if (req.method === 'POST' && pathname === '/api/tickets') { const input = await body(req); const problem = validate(input, false, false); if (problem) return error(res, 400, problem); const now = new Date().toISOString(); const ticket = { id: `T-${randomUUID().slice(0, 8).toUpperCase()}`, title: text(input.title), student: text(input.student), description: text(input.description), status: 'open', createdAt: now, updatedAt: now }; await store.mutate(tickets => { tickets.unshift(ticket); }); return json(res, 201, { ticket }); }
      const match = pathname.match(/^\/api\/tickets\/([^/]+)$/);
      if (match) { const id = decodeURIComponent(match[1]); if (req.method === 'GET') { const ticket = (await store.read()).find(t => t.id === id); return ticket ? json(res, 200, { ticket }) : error(res, 404, 'Ticket not found.'); } if (req.method === 'PATCH') { const input = await body(req); const problem = validate(input, true); if (problem) return error(res, 400, problem); if (Object.keys(input).length === 0) return error(res, 400, 'At least one field is required.'); const ticket = await store.mutate(tickets => { const index = tickets.findIndex(t => t.id === id); if (index < 0) return null; tickets[index] = { ...tickets[index], ...Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' && k !== 'status' ? text(v) : v])), updatedAt: new Date().toISOString() }; return tickets[index]; }); return ticket ? json(res, 200, { ticket }) : error(res, 404, 'Ticket not found.'); } return error(res, 405, 'Method not allowed.'); }
      if (req.method === 'POST' && pathname === '/api/test/reset') { if (!labMode) return error(res, 404, 'Not found.'); return json(res, 200, { tickets: await store.reset() }); }
      if (pathname.startsWith('/api/')) return error(res, 404, 'Not found.');
      if (req.method !== 'GET' && req.method !== 'HEAD') return error(res, 405, 'Method not allowed.');
      const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^[/\\]+/, ''); const root = path.resolve(distDir); const candidate = path.resolve(root, requested); if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return error(res, 403, 'Forbidden.'); let contents; try { contents = await fs.readFile(candidate); } catch (e) { return error(res, e.code === 'ENOENT' ? 404 : 500, e.code === 'ENOENT' ? 'Not found.' : 'Unable to read static file.'); } const extension = path.extname(candidate); const type = extension === '.js' ? 'text/javascript' : extension === '.css' ? 'text/css' : extension === '.svg' ? 'image/svg+xml' : extension === '.json' ? 'application/json' : 'text/html'; res.writeHead(200, { 'content-type': `${type}; charset=utf-8` }); res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (e) { return error(res, e.message === 'Invalid JSON.' || e.message === 'Request body is too large.' ? 400 : 500, e.message === 'Invalid JSON.' || e.message === 'Request body is too large.' ? e.message : 'Internal server error.'); }
  });
}
