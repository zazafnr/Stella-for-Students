import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// Mock-Server für das Stundenplan-Abo (lokaler Rechner nur mit den Test-Schaltern erlaubt – sonst greift der SSRF-Schutz)
let ics = '';
let status = 200;
const feed = createServer((_req, res) => { res.statusCode = status; res.setHeader('content-type', 'text/calendar'); res.end(ics); });
await new Promise<void>((r) => feed.listen(0, '127.0.0.1', r));
const FEED = `http://127.0.0.1:${(feed.address() as AddressInfo).port}/plan.ics`;

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-uni-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.OPENROUTER_API_KEY = '';
process.env.STELLA_ALLOW_REGISTRATION = 'true';
process.env.STELLA_NEWS_ALLOW_PRIVATE = 'true';
process.env.STELLA_STUDENTS_ALLOW_HTTP = 'true';
after(() => { feed.close(); });

const { register, requireUser, HttpError, createSession } = await import('../../../core/server/src/auth.ts');
const { db, getUser, updateUserSettings, listItems } = await import('../../../core/server/src/db.ts');
const { loadEditions } = await import('../../../core/server/src/editions/load.ts');
const { pluginRoutes, pluginTools } = await import('../../../core/server/src/editions/registry.ts');
const { buildLagebild } = await import('../../../core/server/src/context.ts');
const { findHints } = await import('../../../core/server/src/hints.ts');
const { addItem } = await import('../../../core/server/src/planner.ts');
const { netOptions } = await import('../../../core/server/src/news/net.ts');
const { addDays, todayIn } = await import('@stella/shared');
const Fastify = (await import('fastify')).default;
import type { FastifyInstance } from 'fastify';

await loadEditions(path.resolve(import.meta.dirname, '../..'));
const reg = register('Mia', 'mia@example.com', 'supergeheim', 'Europe/Vienna');
updateUserSettings(reg.user.id, { locale: 'de', profile: { situation: 'university', features: ['planner'] } });
const user = () => getUser(reg.user.id)!;
const today = todayIn('Europe/Vienna');
const tomorrow = addDays(today, 1);
const compact = (d: string) => d.replaceAll('-', '');

const app = Fastify();
app.setErrorHandler((err, _req, reply) => (err instanceof HttpError ? reply.code(err.status).send({ ...err.extra, error: err.message }) : reply.code(500).send({ error: (err as Error).message })));
await app.register(async (api: FastifyInstance) => { api.addHook('preHandler', requireUser); pluginRoutes(api); });
await app.ready();
const auth = { authorization: `Bearer ${createSession(reg.user.id, 'test')}` };
const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url, headers: auth, payload: payload as object });

const lesson = (uid: string, date: string, from: string, to: string, summary: string, extra = '') =>
  `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;TZID=Europe/Vienna:${compact(date)}T${from.replace(':', '')}00\r\nDTEND;TZID=Europe/Vienna:${compact(date)}T${to.replace(':', '')}00\r\nSUMMARY:${summary}\r\n${extra}END:VEVENT\r\n`;
const calendar = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('')}END:VCALENDAR\r\n`;

test('Semester, Kurse und Noten: anlegen, prüfen, ändern, löschen – nur eigene Daten', async () => {
  const term = (await call('POST', '/api/students/terms', { name: 'WS 2026/27', from: '2026-10-01', to: '2027-01-31' })).json();
  assert.equal(term.name, 'WS 2026/27');
  assert.equal((await call('POST', '/api/students/terms', { name: '', from: '2026-10-01', to: '2027-01-31' })).statusCode, 400);
  assert.equal((await call('POST', '/api/students/terms', { name: 'X', from: '2027-02-01', to: '2027-01-01' })).statusCode, 400, 'bis vor von');

  const ana = (await call('POST', '/api/students/courses', { name: 'Analysis I', code: 'MA1', lecturer: 'Prof. Huber', ects: 9, termId: term.id, color: '#6D4AFF', location: 'HS 1' })).json();
  const stat = (await call('POST', '/api/students/courses', { name: 'Statistik', code: 'ST', ects: 6, termId: term.id })).json();
  assert.equal((await call('POST', '/api/students/courses', { name: 'Zu viele ECTS', ects: 99 })).statusCode, 400);
  assert.equal((await call('POST', '/api/students/courses', { name: 'Fremd', termId: 'gibt-es-nicht' })).json().termId, null, 'unbekanntes Semester wird ignoriert');
  assert.equal((await call('PATCH', `/api/students/courses/${stat.id}`, { name: 'Statistik I', code: 'ST', ects: 6 })).json().name, 'Statistik I');

  await call('POST', '/api/students/grades', { courseId: ana.id, grade: '1,7', date: '2026-12-01' });
  await call('POST', '/api/students/grades', { courseId: stat.id, grade: 3 });
  await call('POST', '/api/students/grades', { title: 'Seminar', grade: 2, weight: 3 });
  assert.equal((await call('POST', '/api/students/grades', { grade: 'sehr gut' })).statusCode, 400);

  // (1,7·9 + 3·6 + 2·3) / (9 + 6 + 3) = 39,3 / 18 = 2,18 – ECTS-gewichtet, Eigengewicht für die Note ohne Kurs
  const avg = (await call('GET', '/api/students/grades/average')).json();
  assert.equal(avg.average, 2.18);
  assert.equal(avg.count, 3);
  assert.equal(avg.ects, 15);
  const all = (await call('GET', '/api/students/uni')).json();
  assert.equal(all.terms.length, 1);
  assert.ok(all.courses.length >= 3 && all.grades.length === 3);
  assert.equal(all.average.average, 2.18);

  // fremde Daten sind unsichtbar
  const other = register('Sam', 'sam@example.com', 'supergeheim', 'Europe/Vienna');
  const o = { authorization: `Bearer ${createSession(other.user.id, 'test')}` };
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/students/courses/${ana.id}`, headers: o })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/students/uni', headers: o })).json().courses.length, 0);

  const tool = pluginTools(user()).find((t) => t.def.function.name === 'grade_average')!;
  const sum = await tool.run({ user: user(), today, act: () => ({}) }, {}) as { average: number; perCourse: unknown[] };
  assert.equal(sum.average, 2.18);
  assert.ok(sum.perCourse.length >= 2);
});

test('Stundenplan-Abo: abgelehnte Adressen – http, interne Rechner, Zugangsdaten, keine Adresse', async () => {
  netOptions.allowPrivate = false;
  const saved = process.env.STELLA_STUDENTS_ALLOW_HTTP;
  delete process.env.STELLA_STUDENTS_ALLOW_HTTP;
  const put = (url: string) => call('PUT', '/api/students/timetable/ics', { url });
  for (const url of ['http://example.com/plan.ics', 'ftp://example.com/plan.ics', 'file:///etc/passwd', 'quatsch', '']) {
    assert.equal((await put(url)).statusCode, 400, url);
  }
  for (const url of ['https://127.0.0.1/plan.ics', 'https://localhost/plan.ics', 'https://10.0.0.5/plan.ics', 'https://192.168.1.10/x', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/plan.ics', 'https://user:pw@example.com/plan.ics']) {
    const res = await put(url);
    assert.equal(res.statusCode, 400, `${url}: ${res.body}`);
  }
  assert.equal((await call('GET', '/api/students/uni')).json().timetable.url, null, 'nichts gespeichert');
  process.env.STELLA_STUDENTS_ALLOW_HTTP = saved;
  netOptions.allowPrivate = true;
});

test('Stundenplan-Abo: Abruf, Kurszuordnung, Absage, verschwundener und umbenannter Termin, sichtbarer Fehler', async () => {
  ics = calendar(
    lesson('v1', tomorrow, '08:00', '09:30', 'MA1 Analysis I – Vorlesung', 'LOCATION:HS 1\r\n'),
    lesson('v2', tomorrow, '10:00', '11:30', 'Statistik Übung'),
    lesson('v3', addDays(today, 2), '14:00', '15:30', 'Seminar Ethik'),
    lesson('v4', addDays(today, 3), '09:00', '10:00', 'Tutorium', 'STATUS:CANCELLED\r\n'),
  );
  const res = await call('PUT', '/api/students/timetable/ics', { url: FEED });
  assert.equal(res.statusCode, 200, res.body);
  const state = res.json();
  assert.equal(state.lastError, null);
  assert.equal(state.lessons, 4);

  const lessons = db.prepare('SELECT uid, subject, course_id, status, info, location FROM ics_lessons WHERE user_id = ? ORDER BY uid').all(reg.user.id) as { uid: string; subject: string; course_id: string | null; status: string; info: string | null; location: string | null }[];
  const by = Object.fromEntries(lessons.map((l) => [l.uid, l]));
  assert.equal(by.v1!.subject, 'Analysis I', 'über das Kürzel dem Kurs zugeordnet');
  assert.ok(by.v1!.course_id);
  assert.equal(by.v2!.subject, 'Statistik I', 'über den Namen zugeordnet');
  assert.equal(by.v3!.subject, 'Seminar Ethik', 'ohne Kurs bleibt der Titel');
  assert.equal(by.v4!.status, 'cancelled', 'STATUS:CANCELLED');

  // der Unterricht kommt über das Plugin in das Lagebild
  const lb = buildLagebild(user(), 4);
  assert.deepEqual(lb.days[1]!.lessons.map((l) => [l.start, l.subject]), [['08:00', 'Analysis I'], ['10:00', 'Statistik I']]);

  // zweiter Abruf: v2 ist weg (entfällt), v3 umbenannt, v1 unverändert
  ics = calendar(
    lesson('v1', tomorrow, '08:00', '09:30', 'MA1 Analysis I – Vorlesung', 'LOCATION:HS 1\r\n'),
    lesson('v3', addDays(today, 2), '14:00', '15:30', 'Seminar Philosophie'),
  );
  const again = await call('POST', '/api/students/timetable/refresh');
  assert.equal(again.statusCode, 200, again.body);
  const after2 = Object.fromEntries((db.prepare('SELECT uid, subject, status, info FROM ics_lessons WHERE user_id = ?').all(reg.user.id) as { uid: string; subject: string; status: string; info: string | null }[]).map((l) => [l.uid, l]));
  assert.equal(after2.v2!.status, 'cancelled');
  assert.equal(after2.v2!.info, 'nicht mehr im Stundenplan');
  assert.equal(after2.v3!.subject, 'Seminar Philosophie');
  assert.match(after2.v3!.info ?? '', /umbenannt: Seminar Ethik/);
  assert.equal(after2.v1!.status, 'normal');

  // Hinweis: die Vorlesung von morgen entfällt (v2)
  const hints = findHints(user(), buildLagebild(user(), 8));
  assert.ok(hints.some((h) => h.key.startsWith('uni_cancel:') && /Statistik I um 10:00/.test(h.text)), hints.map((h) => h.key).join(','));

  // Fehler sichtbar, nie ein Absturz; die alten Termine bleiben
  status = 500;
  const failed = await call('POST', '/api/students/timetable/refresh');
  assert.equal(failed.statusCode, 502, failed.body);
  assert.match((await call('GET', '/api/students/uni')).json().timetable.lastError, /500/);
  status = 200;
  ics = 'das ist kein Kalender';
  const notIcs = await call('POST', '/api/students/timetable/refresh');
  assert.equal(notIcs.statusCode, 502, notIcs.body);
  assert.match((await call('GET', '/api/students/uni')).json().timetable.lastError, /kein Kalender/);
  ics = calendar();
  assert.equal((await call('POST', '/api/students/timetable/refresh')).statusCode, 200);
  assert.equal((await call('GET', '/api/students/uni')).json().timetable.lastError, null);

  // Abo entfernen: Termine weg
  await call('DELETE', '/api/students/timetable/ics');
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM ics_lessons WHERE user_id = ?').get(reg.user.id) as { n: number }).n, 0);
});

test('Prüfung mit Kurs, Ort und Anmeldefrist; Abgabe mit Erinnerung 7 Tage vorher; Hinweise zu Anmeldung und Abgabe ohne Lernblock', async () => {
  const course = (await call('GET', '/api/students/uni')).json().courses.find((c: { name: string }) => c.name === 'Analysis I');
  const examDay = addDays(today, 20);
  const exam = (await call('POST', '/api/students/exams', { courseId: course.id, date: examDay, time: '09:00', location: 'Audimax', registerBy: addDays(today, 2) })).json();
  assert.equal(exam.exam.kind, 'exam');
  assert.equal(exam.exam.subject, 'Analysis I');
  assert.equal(exam.exam.location, 'Audimax');
  assert.equal(exam.registration.parentId, exam.exam.id);
  assert.match(exam.registration.title, /^Anmeldung:/);
  assert.equal((await call('POST', '/api/students/exams', { date: examDay })).statusCode, 400, 'ohne Kurs');

  const due = addDays(today, 2);
  const a = (await call('POST', '/api/students/assignments', { courseId: course.id, title: 'Übungsblatt 5', due })).json().assignment;
  assert.equal(a.kind, 'assignment');
  assert.equal(a.subject, 'Analysis I');
  // Erinnerungen: 3 Tage und 1 Tag vorher (Kern) plus 7 Tage vorher (Plugin) – letztere nur, solange das Datum nicht schon vorbei ist
  const far = (await call('POST', '/api/students/assignments', { courseId: course.id, title: 'Projekt', due: addDays(today, 30) })).json().assignment;
  const dates = (db.prepare('SELECT fire_at FROM reminders WHERE item_id = ? ORDER BY fire_at').all(far.id) as { fire_at: string }[]).map((r) => r.fire_at.slice(0, 10));
  assert.equal(dates.length, 3, `drei Erinnerungen, war: ${dates.join(', ')}`);
  assert.ok(dates.some((d) => d <= addDays(addDays(today, 30), -6) && d >= addDays(addDays(today, 30), -8)), 'eine Woche vorher');

  const hints = findHints(user(), buildLagebild(user(), 8));
  assert.ok(hints.some((h) => h.key === `uni_register:${exam.registration.id}` && /Anmeldung für Analysis I/.test(h.text)), 'Anmeldefrist läuft ab');
  assert.ok(hints.some((h) => h.key === `uni_assignment:${a.id}` && /Übungsblatt 5/.test(h.text)), 'Abgabe bald, kein Lernblock');
  // mit einem Lernblock ist der Hinweis weg
  addItem(user(), { kind: 'study', subject: 'Analysis I', title: 'Lernen: Übungsblatt', due: today, time: '16:30', parentId: a.id });
  assert.ok(!findHints(user(), buildLagebild(user(), 8)).some((h) => h.key === `uni_assignment:${a.id}`));
  assert.equal(listItems(reg.user.id, { kind: 'exam' }).filter((i) => i.subject === 'Analysis I').length, 1);
});
