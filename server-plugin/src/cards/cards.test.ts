import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-cards-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.STELLA_ALLOW_REGISTRATION = 'true';
process.env.STELLA_DEFAULT_PLAN = 'free';
process.env.OPENROUTER_API_KEY = '';

const { startMockClaude, text } = await import('../../../core/server/src/testing/mockClaude.ts');
let script: (n: number) => ReturnType<typeof text> = () => text('{"cards":[]}');
const claude = await startMockClaude((_req, n) => script(n));
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123456';
process.env.ANTHROPIC_BASE_URL = claude.url;
process.env.STELLA_CLAUDE_RETRY_MS = '5';
after(() => claude.close());

const { register, requireUser, HttpError, createSession } = await import('../../../core/server/src/auth.ts');
const { db, getUser, updateUserSettings, createItem } = await import('../../../core/server/src/db.ts');
const { loadEditions } = await import('../../../core/server/src/editions/load.ts');
const { pluginRoutes, pluginTools } = await import('../../../core/server/src/editions/registry.ts');
const { buildBriefing } = await import('../../../core/server/src/briefing.ts');
const { buildLagebild } = await import('../../../core/server/src/context.ts');
const { setPushForTests } = await import('../../../core/server/src/channels/deliver.ts');
const { usedCount } = await import('../../../core/server/src/billing.ts');
const { addDays, timeIn, todayIn } = await import('@stella/shared');
const Fastify = (await import('fastify')).default;
import type { FastifyInstance } from 'fastify';
const cards = await import('./cards.ts');
const { cardNudges } = await import('./hooks.ts');

await loadEditions(path.resolve(import.meta.dirname, '../..'));
register('Owner', 'owner@example.com', 'supergeheim', 'Europe/Vienna'); // erstes Konto = Owner (Max) – damit Mia ein Free-Konto ist
const reg = register('Mia', 'mia@example.com', 'supergeheim', 'America/Los_Angeles');
db.prepare("UPDATE users SET edition = 'students' WHERE id = ?").run(reg.user.id);
updateUserSettings(reg.user.id, { locale: 'de' });
const user = () => getUser(reg.user.id)!;
const today = () => todayIn(user().timeZone);

const app = Fastify();
app.setErrorHandler((err, _req, reply) => (err instanceof HttpError ? reply.code(err.status).send({ ...err.extra, error: err.message }) : reply.code(500).send({ error: (err as Error).message })));
await app.register(async (api: FastifyInstance) => { api.addHook('preHandler', requireUser); pluginRoutes(api); });
await app.ready();
const auth = { authorization: `Bearer ${createSession(reg.user.id, 'test')}` };
const call = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url, headers: auth, payload: payload as object });

const json = (n: number) => text(JSON.stringify({ cards: Array.from({ length: n }, (_, i) => ({ front: `Frage ${i + 1}`, back: `Antwort ${i + 1}` })) }));

test('Stapel von Hand: Karten ohne Doppelte, neue Karten sind heute dran, Antworten verschieben die Fälligkeit nach dem Ortstag der Person', async () => {
  const deck = (await call('POST', '/api/students/decks', { title: 'Französisch Vokabeln', subject: 'Französisch', cards: [{ front: 'la maison', back: 'das Haus' }, { front: 'LA MAISON', back: 'doppelt' }, { front: 'le chat', back: 'die Katze' }, { front: '', back: 'leer' }] })).json().deck;
  assert.equal(deck.cards, 2, 'Doppelte und leere Karten fallen weg');
  assert.equal(deck.due, 2);
  const t = (await call('GET', '/api/students/cards/today')).json();
  assert.equal(t.due, 2);
  const [a, b] = t.cards as { id: string; front: string; due: string; stage: number }[];
  assert.deepEqual([a!.due, a!.stage], [today(), 1]);

  // richtig → Stufe 2, in 3 Tagen (Kalendertage in Los Angeles, nicht UTC)
  const right = (await call('POST', `/api/students/cards/${a!.id}/answer`, { correct: true })).json().card;
  assert.deepEqual([right.stage, right.due], [2, addDays(today(), 3)]);
  // falsch → Stufe 1, morgen
  const wrong = (await call('POST', `/api/students/cards/${b!.id}/answer`, { correct: false })).json().card;
  assert.deepEqual([wrong.stage, wrong.due], [1, addDays(today(), 1)]);
  assert.equal((await call('GET', '/api/students/cards/today')).json().due, 0, 'danach ist heute nichts mehr dran');
  assert.equal((await call('POST', '/api/students/cards/gibt-es-nicht/answer', { correct: true })).statusCode, 404);
  assert.equal((await call('POST', '/api/students/decks', { title: '' })).statusCode, 400);

  // eine Karte nach Stufe 5 und falscher Antwort: zurück auf Stufe 1
  db.prepare('UPDATE cards SET stage = 5, due = ? WHERE id = ?').run(today(), a!.id);
  const back = (await call('POST', `/api/students/cards/${a!.id}/answer`, { correct: false })).json().card;
  assert.deepEqual([back.stage, back.due], [1, addDays(today(), 1)]);

  // fremde Karten sind unsichtbar
  const other = register('Sam', 'sam@example.com', 'supergeheim', 'Europe/Vienna');
  const o = { authorization: `Bearer ${createSession(other.user.id, 'test')}` };
  assert.equal((await app.inject({ method: 'POST', url: `/api/students/cards/${a!.id}/answer`, headers: o, payload: { correct: true } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/students/decks', headers: o })).json().decks.length, 0);
});

test('KI-Erzeugung: festes JSON, höchstens 40 Karten, gekürzt, ohne Doppelte; zählt als KI-Nachricht und Lernkarten-Erzeugung – erst nach Erfolg', async () => {
  const usedBefore = [usedCount(user(), 'flashcards'), usedCount(user(), 'ai_message')];
  // Müll → klare Fehlermeldung, nichts verbraucht, kein Stapel
  script = () => text('Hier sind deine Karten: gern geschehen!');
  const bad = await call('POST', '/api/students/decks/generate', { title: 'Bio', text: 'Die Zelle ist die kleinste Einheit des Lebens. Mitochondrien erzeugen Energie.' });
  assert.equal(bad.statusCode, 502, bad.body);
  assert.deepEqual([usedCount(user(), 'flashcards'), usedCount(user(), 'ai_message')], usedBefore);
  assert.equal(cards.listDecks(user()).filter((d) => d.title === 'Bio').length, 0);

  // 55 Karten angeliefert → 40, mit Zaun-Markierung und Doppelten
  script = () => text('```json\n' + JSON.stringify({ cards: [...Array.from({ length: 55 }, (_, i) => ({ front: `Begriff ${i % 50}`, back: `Erklärung ${i}`.repeat(200) })), { front: 'x', back: '' }] }) + '\n```');
  const ok = await call('POST', '/api/students/decks/generate', { title: 'Bio', subject: 'Biologie', text: 'Die Zelle ist die kleinste Einheit des Lebens. Mitochondrien erzeugen Energie. '.repeat(5), count: 99 });
  assert.equal(ok.statusCode, 200, ok.body);
  const res = ok.json();
  assert.equal(res.added.length, 40, 'höchstens 40 Karten je Aufruf');
  assert.ok(res.added.every((c: { back: string }) => c.back.length <= 600), 'Rückseiten gekürzt');
  assert.equal(res.deck.source, 'text');
  assert.deepEqual([usedCount(user(), 'flashcards'), usedCount(user(), 'ai_message')], [usedBefore[0]! + 1, usedBefore[1]! + 1]);

  // zu wenig Text → 400, nichts verbraucht
  assert.equal((await call('POST', '/api/students/decks/generate', { title: 'x', text: 'kurz' })).statusCode, 400);
  assert.equal(usedCount(user(), 'flashcards'), usedBefore[0]! + 1);
});

test('Limit je Abo (Free: 2 Lernkarten-Erzeugungen im Monat) – danach klare Meldung mit Hinweis auf das Abo', async () => {
  script = () => json(5);
  const text2 = 'Der Satz des Pythagoras gilt in rechtwinkligen Dreiecken: a² + b² = c². '.repeat(3);
  const second = await call('POST', '/api/students/decks/generate', { title: 'Mathe', text: text2 });
  assert.equal(second.statusCode, 200, second.body);
  const third = await call('POST', '/api/students/decks/generate', { title: 'Mathe 2', text: text2 });
  assert.equal(third.statusCode, 403);
  assert.equal(third.json().code, 'quota');
  assert.match(third.json().error, /\(2\)/);
});

test('Stoff einer Prüfung als Quelle; ohne Stoff eine freundliche Rückfrage', async () => {
  db.prepare("UPDATE usage_counters SET count = 0 WHERE user_id = ?").run(reg.user.id);
  const exam = createItem(reg.user.id, { kind: 'exam', title: 'Bio Prüfung', subject: 'Biologie', due: addDays(today(), 10) });
  const none = await call('POST', '/api/students/decks/generate', { examId: exam.id });
  assert.equal(none.statusCode, 400);
  db.prepare('UPDATE items SET material = ? WHERE id = ?').run('Zellbiologie: Zellkern, Mitochondrien, Ribosomen, Zellmembran und ihre Aufgaben', exam.id);
  let seen = '';
  script = () => json(6);
  const orig = claude.requests.length;
  const ok = await call('POST', '/api/students/decks/generate', { examId: exam.id });
  assert.equal(ok.statusCode, 200, ok.body);
  seen = JSON.stringify(claude.requests.at(-1)!.body.messages);
  assert.match(seen, /Mitochondrien/, 'der Stoff geht an die KI');
  assert.ok(claude.requests.length > orig);
  assert.equal(ok.json().deck.source, 'exam');
  assert.equal(ok.json().deck.subject, 'Biologie');
});

test('Abfrage im Chat: Werkzeuge due_cards (nach Fach) und answer_card – und die Bewertung ändert die Fälligkeit', async () => {
  const tools = Object.fromEntries(pluginTools(user()).map((t) => [t.def.function.name, t]));
  const ctx = { user: user(), today: today(), act: () => ({}) };
  const due = await tools.due_cards!.run(ctx, { subject: 'Biologie', limit: 3 }) as { total: number; cards: { id: string; front: string; back: string }[] };
  assert.equal(due.cards.length, 3);
  assert.ok(due.total >= 3);
  assert.ok(due.cards.every((c) => c.back));
  const done = await tools.answer_card!.run(ctx, { card_id: due.cards[0]!.id, correct: true }) as { ok: boolean; nextDue: string; stage: number };
  assert.deepEqual([done.ok, done.stage, done.nextDue], [true, 2, addDays(today(), 3)]);
  assert.deepEqual(await tools.answer_card!.run(ctx, { card_id: 'x', correct: true }), { error: 'Karte nicht gefunden' });
  assert.deepEqual((await tools.due_cards!.run(ctx, { subject: 'gibt-es-nicht' }) as { cards: unknown[] }).cards, []);
});

test('Briefing: eine Zeile mit der Zahl fälliger Karten – keine Punkte, keine Serien', () => {
  const b = buildBriefing(user(), buildLagebild(user(), 3));
  const sec = b.sections.find((s) => s.id === 'cards');
  assert.ok(sec, 'Abschnitt Lernkarten');
  assert.equal(sec!.lines.length, 1);
  assert.match(sec!.lines[0]!, /Lernkarten sind heute fällig|Lernkarte ist heute fällig/);
  assert.doesNotMatch(JSON.stringify(b), /Punkte|Serie|Streak|Abzeichen/i);
});

test('Anstoß in der Lernzeit: einmal je Einheit, nur bei genug fälligen Karten, nie ohne Recht', async () => {
  const pushes: string[] = [];
  setPushForTests(async (_id, p) => { pushes.push(p.body ?? ''); return undefined as never; });
  // genug fällige Karten
  const deck = (await call('POST', '/api/students/decks', { title: 'Sprint', subject: 'Latein', cards: Array.from({ length: 8 }, (_, i) => ({ front: `Wort ${i}`, back: `Wort-Übersetzung ${i}` })) })).json().deck;
  assert.ok(deck.due >= 5);
  const nowMin = Number(timeIn(user().timeZone).slice(0, 2)) * 60 + Number(timeIn(user().timeZone).slice(3, 5));
  const at = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // Lerneinheit, die vor 3 Minuten begonnen hat (bei Mitternacht wäre der Tag ein anderer – dann überspringen)
  if (nowMin < 5) return;
  const session = createItem(reg.user.id, { kind: 'study', title: 'Lernen: Latein', subject: 'Latein', due: today(), time: at(nowMin - 3) });

  updateUserSettings(reg.user.id, { permissions: { learning: 'never' } });
  await cardNudges(reg.user.id);
  assert.equal(pushes.length, 0, 'Recht „nie“: kein Anstoß');
  updateUserSettings(reg.user.id, { permissions: {} });

  await cardNudges(reg.user.id);
  assert.equal(pushes.length, 1);
  assert.match(pushes[0]!, /Lernkarten sind fällig/);
  await cardNudges(reg.user.id);
  assert.equal(pushes.length, 1, 'höchstens einmal je Einheit');

  // eine Einheit, die erst in einer Stunde beginnt: kein Anstoß
  createItem(reg.user.id, { kind: 'study', title: 'Lernen: später', subject: 'Latein', due: today(), time: at((nowMin + 60) % (24 * 60)) });
  await cardNudges(reg.user.id);
  assert.equal(pushes.length, 1);
  void session;
  setPushForTests(undefined);
});
