import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-sum-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.STELLA_ALLOW_REGISTRATION = 'true';
process.env.STELLA_DEFAULT_PLAN = 'free';
process.env.OPENROUTER_API_KEY = '';

const { startMockClaude, text } = await import('../../../core/server/src/testing/mockClaude.ts');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let script: (n: number, body: any) => ReturnType<typeof text> = () => text('{}');
const seen: any[] = [];
const claude = await startMockClaude((req, n) => { seen.push(req.body); return script(n, req.body); });
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123456';
process.env.ANTHROPIC_BASE_URL = claude.url;
process.env.STELLA_CLAUDE_RETRY_MS = '5';
after(() => claude.close());

const { register, requireUser, HttpError, createSession } = await import('../../../core/server/src/auth.ts');
const { db, getUser, updateUserSettings, createItem, getItem } = await import('../../../core/server/src/db.ts');
const { loadEditions } = await import('../../../core/server/src/editions/load.ts');
const { pluginRoutes } = await import('../../../core/server/src/editions/registry.ts');
const { setSubscription, usedCount } = await import('../../../core/server/src/billing.ts');
const Fastify = (await import('fastify')).default;
import type { FastifyInstance } from 'fastify';
const sum = await import('./summaries.ts');
const { notesInbox, ackNotesEntry } = await import('../notes.ts');

await loadEditions(path.resolve(import.meta.dirname, '../..'));
register('Owner', 'owner@example.com', 'supergeheim', 'Europe/Vienna');
const reg = register('Mia', 'mia@example.com', 'supergeheim', 'Europe/Vienna');
db.prepare("UPDATE users SET edition = 'students' WHERE id = ?").run(reg.user.id);
updateUserSettings(reg.user.id, { locale: 'de' });
const user = () => getUser(reg.user.id)!;

const app = Fastify();
app.setErrorHandler((err, _req, reply) => (err instanceof HttpError ? reply.code(err.status).send({ ...err.extra, error: err.message }) : reply.code(500).send({ error: (err as Error).message })));
await app.register(async (api: FastifyInstance) => { api.addHook('preHandler', requireUser); pluginRoutes(api); });
await app.ready();
const auth = { authorization: `Bearer ${createSession(reg.user.id, 'test')}` };
const call = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url, headers: auth, payload: payload as object });

const page = (n: number) => text(`Seite ${n}: Photosynthese – Licht + CO2 + Wasser → Glukose + Sauerstoff`);
const summary = text(JSON.stringify({
  title: 'Photosynthese', outline: ['Ablauf: Lichtreaktion und Calvin-Zyklus', 'Ort: Chloroplasten'], keySentences: ['Photosynthese erzeugt Glukose und Sauerstoff.'],
  terms: [{ term: 'Chlorophyll', explanation: 'grüner Farbstoff, fängt Licht ein' }], open: ['Formel auf Seite 2 war unleserlich'],
}));

test('Im Gratis-Abo gibt es nur einen Hinweis, keinen Modellaufruf', async () => {
  const before = seen.length;
  const r = await call('POST', '/api/students/summaries', { images: [PNG] });
  assert.equal(r.statusCode, 403);
  assert.equal(r.json().code, 'quota');
  assert.match(r.json().error, /bezahlten Abos/);
  assert.equal(seen.length, before, 'kein Aufruf an die KI');
});

test('zwei Fotos: Seiten nacheinander, dann eine Zusammenfassung; eine Profi-Aufgabe und ein Mitschrift-Platz', async () => {
  setSubscription(reg.user.id, { plan: 'plus', status: 'active', provider: 'gift', currentPeriodEnd: new Date(Date.now() + 864e5 * 30).toISOString() });
  script = (n) => (n <= 2 ? page(n) : summary);
  const start = seen.length;
  const { id } = (await call('POST', '/api/students/summaries', { images: [PNG, PNG], subject: 'Biologie' })).json();
  await sum.finished(id);
  const s = (await call('GET', `/api/students/summaries/${id}`)).json().summary;
  assert.equal(s.status, 'done');
  assert.equal(s.title, 'Photosynthese');
  assert.equal(s.subject, 'Biologie');
  assert.equal(s.pages, 2);
  assert.match(s.text, /Chlorophyll: grüner Farbstoff/);
  assert.deepEqual(s.openQuestions, ['Formel auf Seite 2 war unleserlich']);
  assert.equal(seen.length - start, 3, 'zwei Seiten + eine Zusammenfassung');
  // Bild kam wirklich beim Modell an
  assert.ok(JSON.stringify(seen[start]).includes('"type":"image"') || JSON.stringify(seen[start]).includes('base64'));
  assert.equal(usedCount(user(), 'pro_task'), 1);
  assert.equal(usedCount(user(), 'notes'), 1);
  assert.equal((await call('GET', '/api/students/summaries')).json().summaries.length, 1);

  // Karten daraus
  script = () => text(JSON.stringify({ cards: [{ front: 'Was ist Chlorophyll?', back: 'Grüner Farbstoff' }, { front: 'Wo läuft Photosynthese ab?', back: 'In den Chloroplasten' }] }));
  const c = (await call('POST', `/api/students/summaries/${id}/cards`, {})).json();
  assert.equal(c.added.length, 2);
  assert.equal(c.deck.title, 'Photosynthese');

  // als Prüfungsstoff: Lernplan wird ausgelöst
  const exam = createItem(reg.user.id, { kind: 'exam', title: 'Bio-Schularbeit', due: new Date(Date.now() + 864e5 * 10).toISOString().slice(0, 10), subject: 'Biologie', status: 'open' } as never);
  script = () => text('{}');
  const ex = (await call('POST', `/api/students/summaries/${id}/exam`, { examId: exam.id })).json().result;
  assert.ok(['done', 'pending'].includes(ex.status), `Status: ${ex.status}`);
  if (ex.status === 'done') assert.match(getItem(reg.user.id, exam.id)!.material ?? '', /Chlorophyll/);

  // Ins Heft: wartet in der FreeNotes-Abholung, einmal
  assert.equal((await call('POST', `/api/students/summaries/${id}/notebook`)).statusCode, 200);
  const inbox = notesInbox(reg.user.id);
  assert.equal(inbox.length, 1);
  assert.match(inbox[0]!.text, /^__Photosynthese__/);
  assert.ok(ackNotesEntry(reg.user.id, id, 'Bio-Heft', 1));
  assert.equal(notesInbox(reg.user.id).length, 0);
});

test('Abbruch räumt auf: Eintrag weg, nichts gezählt, kein weiterer Aufruf', async () => {
  const usedBefore = usedCount(user(), 'notes');
  let id = '';
  const calls0 = seen.length;
  script = (n) => { if (n === calls0 + 1) sum.cancelSummary(reg.user.id, (db.prepare("SELECT id FROM notes_summaries WHERE status = 'working'").get() as { id: string }).id); return page(n); };
  id = (await call('POST', '/api/students/summaries', { images: [PNG, PNG, PNG] })).json().id;
  await sum.finished(id);
  assert.equal(sum.getSummary(reg.user.id, id), null);
  assert.equal(usedCount(user(), 'notes'), usedBefore);
  assert.equal(seen.length - calls0, 1, 'nach dem Abbruch keine weitere Seite');
  assert.equal((await call('POST', `/api/students/summaries/${id}/cancel`)).statusCode, 404);
});

test('Fehlschlag wird sichtbar, kostet nichts; ungültige Bilder werden abgelehnt', async () => {
  const used = usedCount(user(), 'pro_task');
  script = () => text('');
  const { id } = (await call('POST', '/api/students/summaries', { images: [PNG] })).json();
  await sum.finished(id);
  const s = sum.getSummary(reg.user.id, id)!;
  assert.equal(s.status, 'failed');
  assert.ok(s.error);
  assert.equal(usedCount(user(), 'pro_task'), used);
  assert.equal((await call('POST', '/api/students/summaries', { images: ['kein-bild'] })).statusCode, 400);
  assert.equal((await call('POST', '/api/students/summaries', { images: [] })).statusCode, 400);
  assert.equal((await call('DELETE', `/api/students/summaries/${id}`)).statusCode, 200);
});
