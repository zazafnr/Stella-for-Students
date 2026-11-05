import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-hints-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.OPENROUTER_API_KEY = '';

const { register } = await import('../../core/server/src/auth.ts');
const { db, getItem, getPending, getUser, listItems, recentMessages, updateUserSettings } = await import('../../core/server/src/db.ts');
const { addItem } = await import('../../core/server/src/planner.ts');
const { acceptHint, deliverHint, dismissHint, findHints, isDelivered } = await import('../../core/server/src/hints.ts');
const { briefingTime, buildBriefing } = await import('../../core/server/src/briefing.ts');
const { buildLagebild } = await import('../../core/server/src/context.ts');
const { handleChat } = await import('../../core/server/src/assistant.ts');
const { addDays, todayIn } = await import('@stella/shared');

const { user: created } = register('Lukas', 'lukas@example.com', 'supergeheim', 'Europe/Vienna');
const user = () => getUser(created.id)!;
const today = todayIn('Europe/Vienna');
const keys = () => findHints(user()).map((h) => h.key.split(':')[0]);
const { loadEditions } = await import('../../core/server/src/editions/load.ts');
await loadEditions(path.resolve(import.meta.dirname, '..'));

test('Stunde entfällt morgen, HÜ dafür steht noch drin → auf die nächste Stunde verschieben', () => {
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 8);
  const ins = db.prepare('INSERT INTO lessons (user_id, date, start, end, subject, subject_code, status, info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run(created.id, tomorrow, '09:40', '10:30', 'Latein', 'L', 'cancelled', null);
  ins.run(created.id, nextWeek, '09:40', '10:30', 'Latein', 'L', 'normal', null);
  const hw = addItem(user(), { kind: 'homework', title: 'Latein HÜ', subject: 'Latein', due: tomorrow, detail: 'S. 20 Nr. 3' });
  const h = findHints(user()).find((x) => x.key === `cancelled:${hw.id}:${tomorrow}`)!;
  assert.equal(h.priority, 'high');
  acceptHint(user(), h.key);
  assert.equal(getItem(created.id, hw.id)!.due, nextWeek);
});

test('HÜ für morgen ohne Foto und ohne Buch – erst am Nachmittag melden', () => {
  const hw = addItem(user(), { kind: 'homework', title: 'Physik HÜ', subject: 'Physik', due: addDays(today, 1) });
  const lb = buildLagebild(user(), 8);
  assert.ok(!findHints(user(), { ...lb, now: '10:00' }).some((h) => h.key === `no_source:${hw.id}`));
  assert.ok(findHints(user(), { ...lb, now: '16:00' }).some((h) => h.key === `no_source:${hw.id}`));
});

test('Briefing-Zeit: vor der ersten Stunde, fest oder aus', () => {
  db.prepare('INSERT INTO lessons (user_id, date, start, end, subject, subject_code, status, info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(created.id, today, '07:55', '08:45', 'Mathe', 'M', 'normal', null);
  const lb = buildLagebild(user(), 3);
  assert.equal(briefingTime(user(), lb), '07:10');
  updateUserSettings(created.id, { briefing: '06:30' });
  assert.equal(briefingTime(user(), lb), '06:30');
  updateUserSettings(created.id, { briefing: 'off' });
  assert.equal(briefingTime(user(), lb), null);
  updateUserSettings(created.id, { briefing: 'auto' });
});

test('Briefing: Schule, Heute, Morgen fällig, Hinweise – im eingestellten Ton', async () => {
  updateUserSettings(created.id, { tone: 'cool' });
  addItem(user(), { kind: 'assignment', title: 'Geschichte Referat', due: today, time: '10:00' });
  const b = buildBriefing(user());
  assert.match(b.greeting, /^☀️ Morgen, Lukas\. Dein /);
  assert.deepEqual(b.sections.map((s) => s.id).slice(0, 2), ['school', 'due']);
  assert.ok(b.sections.find((s) => s.id === 'tomorrow')?.lines.some((l) => l.includes('Physik HÜ')));
  assert.ok(b.hints.length > 0);
  assert.match(b.text, /Mir ist aufgefallen/);
  const res = await handleChat(user(), 'Briefing', null);
  assert.match(res.messages[0]!.text, /Dein /);
  assert.equal(recentMessages(created.id, 1)[0]!.text, res.messages[0]!.text);
});
