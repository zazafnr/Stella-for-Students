// Uni-Grundlagen: Semester, Kurse, Noten und der Stundenplan per ICS-Abo.
// Fächer der Schule und Kurse der Uni sind dieselbe Sache mit zwei Oberflächen: ein Kurs ist ein Fach mit Farbe, Kürzel, Dozent:in und ECTS.

import { addDays, todayIn, type Item } from '@stella/shared';
import { db, fetchText, getSecret, newId, setSecret, deleteSecret, hasSecret, HttpError, assertPublicUrl, type Lesson, type User } from '../runtime.ts';
import { parseIcs } from './ics.ts';

export interface Term { id: string; name: string; from: string; to: string }
export interface Course { id: string; termId: string | null; name: string; code: string | null; lecturer: string | null; ects: number | null; color: string | null; location: string | null }
export interface Grade { id: string; courseId: string | null; title: string | null; grade: number; weight: number | null; date: string | null }

const now = () => new Date().toISOString();
const text = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// ---------- Semester ----------

type TermRow = { id: string; name: string; from_date: string; to_date: string };
const toTerm = (r: TermRow): Term => ({ id: r.id, name: r.name, from: r.from_date, to: r.to_date });

export const listTerms = (userId: string): Term[] => (db.prepare('SELECT * FROM terms WHERE user_id = ? ORDER BY from_date DESC').all(userId) as TermRow[]).map(toTerm);

export function saveTerm(userId: string, raw: Record<string, unknown>, id?: string): Term {
  const name = text(raw.name, 60); const from = ymd(raw.from); const to = ymd(raw.to);
  if (!name) throw new HttpError(400, 'Der Name des Semesters fehlt.');
  if (!from || !to || to < from) throw new HttpError(400, 'Von und bis müssen Daten sein, bis nicht vor von.');
  if (id) {
    if (!db.prepare('UPDATE terms SET name = ?, from_date = ?, to_date = ? WHERE id = ? AND user_id = ?').run(name, from, to, id, userId).changes) throw new HttpError(404, 'Nicht gefunden');
    return { id, name, from, to };
  }
  const nid = newId();
  db.prepare('INSERT INTO terms (id, user_id, name, from_date, to_date) VALUES (?, ?, ?, ?, ?)').run(nid, userId, name, from, to);
  return { id: nid, name, from, to };
}

export const deleteTerm = (userId: string, id: string) => db.prepare('DELETE FROM terms WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;

// ---------- Kurse ----------

type CourseRow = { id: string; term_id: string | null; name: string; code: string | null; lecturer: string | null; ects: number | null; color: string | null; location: string | null };
const toCourse = (r: CourseRow): Course => ({ id: r.id, termId: r.term_id, name: r.name, code: r.code, lecturer: r.lecturer, ects: r.ects, color: r.color, location: r.location });

export const listCourses = (userId: string): Course[] => (db.prepare('SELECT * FROM courses WHERE user_id = ? ORDER BY name').all(userId) as CourseRow[]).map(toCourse);
export const getCourse = (userId: string, id: string): Course | null => { const r = db.prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?').get(id, userId) as CourseRow | undefined; return r ? toCourse(r) : null; };

export function saveCourse(userId: string, raw: Record<string, unknown>, id?: string): Course {
  const name = text(raw.name, 80);
  if (!name) throw new HttpError(400, 'Der Name des Kurses fehlt.');
  const termId = typeof raw.termId === 'string' && db.prepare('SELECT 1 FROM terms WHERE id = ? AND user_id = ?').get(raw.termId, userId) ? raw.termId : null;
  const ects = raw.ects === null || raw.ects === '' || raw.ects === undefined ? null : Number(raw.ects);
  if (ects !== null && (!Number.isFinite(ects) || ects < 0 || ects > 60)) throw new HttpError(400, 'ECTS: eine Zahl zwischen 0 und 60.');
  const color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color : null;
  const v = [termId, name, text(raw.code, 20) || null, text(raw.lecturer, 80) || null, ects, color, text(raw.location, 80) || null];
  if (id) {
    if (!db.prepare('UPDATE courses SET term_id = ?, name = ?, code = ?, lecturer = ?, ects = ?, color = ?, location = ? WHERE id = ? AND user_id = ?').run(...v, id, userId).changes) throw new HttpError(404, 'Nicht gefunden');
    return getCourse(userId, id)!;
  }
  const nid = newId();
  db.prepare('INSERT INTO courses (id, user_id, term_id, name, code, lecturer, ects, color, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(nid, userId, ...v, now());
  return getCourse(userId, nid)!;
}

export const deleteCourse = (userId: string, id: string) => db.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;

/** Welcher Kurs gehört zu diesem Titel (Kürzel oder Name kommt im Titel vor; der längste Treffer gewinnt)? */
export function matchCourse(courses: Course[], title: string): Course | null {
  const hay = title.toLowerCase();
  let best: { c: Course; len: number } | null = null;
  for (const c of courses) {
    for (const key of [c.code, c.name]) {
      const k = key?.trim().toLowerCase();
      if (k && k.length >= 2 && hay.includes(k) && (!best || k.length > best.len)) best = { c, len: k.length };
    }
  }
  return best?.c ?? null;
}

// ---------- Noten und Schnitt ----------

type GradeRow = { id: string; course_id: string | null; title: string | null; grade: number; weight: number | null; date: string | null };
const toGrade = (r: GradeRow): Grade => ({ id: r.id, courseId: r.course_id, title: r.title, grade: r.grade, weight: r.weight, date: r.date });

export const listGrades = (userId: string): Grade[] => (db.prepare('SELECT * FROM grades WHERE user_id = ? ORDER BY date DESC, created_at DESC').all(userId) as GradeRow[]).map(toGrade);

export function saveGrade(userId: string, raw: Record<string, unknown>, id?: string): Grade {
  const grade = Number(String(raw.grade ?? '').replace(',', '.'));
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) throw new HttpError(400, 'Die Note muss eine Zahl sein.');
  const weight = raw.weight === null || raw.weight === '' || raw.weight === undefined ? null : Number(raw.weight);
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 100)) throw new HttpError(400, 'Gewicht: eine positive Zahl.');
  const courseId = typeof raw.courseId === 'string' && getCourse(userId, raw.courseId) ? raw.courseId : null;
  const v = [courseId, text(raw.title, 80) || null, grade, weight, ymd(raw.date)];
  if (id) {
    if (!db.prepare('UPDATE grades SET course_id = ?, title = ?, grade = ?, weight = ?, date = ? WHERE id = ? AND user_id = ?').run(...v, id, userId).changes) throw new HttpError(404, 'Nicht gefunden');
    return listGrades(userId).find((g) => g.id === id)!;
  }
  const nid = newId();
  db.prepare('INSERT INTO grades (id, user_id, course_id, title, grade, weight, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(nid, userId, ...v, now());
  return listGrades(userId).find((g) => g.id === nid)!;
}

export const deleteGrade = (userId: string, id: string) => db.prepare('DELETE FROM grades WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;

/**
 * Schnitt nach ECTS gewichtet: Gewicht je Note = eigenes Gewicht, sonst ECTS des Kurses, sonst 1. Keine Prognosen, keine Bewertung der Zahl
 * (jedes Land rechnet anders: 1 kann die beste oder die schlechteste Note sein).
 */
export function gradeAverage(userId: string): { average: number | null; count: number; weightSum: number; ects: number } {
  const courses = new Map(listCourses(userId).map((c) => [c.id, c]));
  let sum = 0; let weights = 0; let ects = 0;
  const grades = listGrades(userId);
  for (const g of grades) {
    const w = g.weight ?? (g.courseId ? courses.get(g.courseId)?.ects : null) ?? 1;
    sum += g.grade * w; weights += w;
    if (g.courseId && courses.get(g.courseId)?.ects) ects += courses.get(g.courseId)!.ects!;
  }
  return { average: weights ? Math.round((sum / weights) * 100) / 100 : null, count: grades.length, weightSum: weights, ects };
}

// ---------- Stundenplan per ICS-Abo ----------

const FEED_SECRET = 'students:timetable-ics';
const WINDOW_BACK = 7;
const WINDOW_FORWARD = 90;

/** Nur https (und nur öffentliche Adressen – der SSRF-Schutz des Kerns prüft den Namen und jede Weiterleitung). */
export async function checkFeedUrl(raw: string): Promise<string> {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new HttpError(400, 'Das ist keine gültige Adresse.'); }
  if (u.protocol !== 'https:' && !(process.env.STELLA_STUDENTS_ALLOW_HTTP === 'true' && u.protocol === 'http:')) throw new HttpError(400, 'Der Stundenplan-Link muss mit https:// beginnen.');
  try { await assertPublicUrl(u.toString()); } catch (err) { throw new HttpError(400, (err as Error).message); }
  return u.toString();
}

export const feedUrl = (userId: string): string | null => getSecret<{ url: string }>(userId, FEED_SECRET)?.url ?? null;

export async function saveFeed(userId: string, raw: string): Promise<void> {
  const url = await checkFeedUrl(raw);
  setSecret(userId, FEED_SECRET, { url });
  db.prepare('INSERT OR IGNORE INTO timetable_feeds (user_id) VALUES (?)').run(userId);
}

export function removeFeed(userId: string): void {
  deleteSecret(userId, FEED_SECRET);
  db.prepare('DELETE FROM timetable_feeds WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM ics_lessons WHERE user_id = ?').run(userId);
}

export const feedState = (userId: string) => {
  const r = db.prepare('SELECT last_run, last_ok, last_error, lessons FROM timetable_feeds WHERE user_id = ?').get(userId) as { last_run: string | null; last_ok: string | null; last_error: string | null; lessons: number } | undefined;
  return { url: feedUrl(userId), lastRun: r?.last_run ?? null, lastOk: r?.last_ok ?? null, lastError: r?.last_error ?? null, lessons: r?.lessons ?? 0 };
};

/**
 * Stundenplan abrufen und speichern: Termine den Kursen zuordnen (über Titel), verschwundene oder umbenannte Termine erkennen.
 * Fehler landen sichtbar in den Einstellungen (`last_error`), nie als Absturz.
 */
export async function refreshTimetable(user: User): Promise<{ lessons: number; changed: number }> {
  const url = feedUrl(user.id);
  if (!url) throw new HttpError(404, 'Es ist kein Stundenplan-Link eingetragen.');
  const stamp = now();
  db.prepare('INSERT OR IGNORE INTO timetable_feeds (user_id) VALUES (?)').run(user.id);
  try {
    await checkFeedUrl(url);
    const res = await fetchText(url, { strict: true, timeoutMs: 15_000 });
    if (res.status >= 400) throw new Error(`Der Server des Stundenplans antwortet mit ${res.status}.`);
    if (!/BEGIN:VCALENDAR/i.test(res.body)) throw new Error('Unter diesem Link liegt kein Kalender (.ics).');
    const today = todayIn(user.timeZone);
    const from = addDays(today, -WINDOW_BACK);
    const to = addDays(today, WINDOW_FORWARD);
    const events = parseIcs(res.body, user.timeZone, from, to);
    const courses = listCourses(user.id);
    let changed = 0;
    db.transaction(() => {
      const get = db.prepare('SELECT subject, status, info FROM ics_lessons WHERE user_id = ? AND uid = ? AND date = ? AND start = ?');
      const put = db.prepare(`INSERT INTO ics_lessons (user_id, uid, date, start, end, subject, course_id, location, status, info, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, uid, date, start) DO UPDATE SET end = excluded.end, subject = excluded.subject, course_id = excluded.course_id, location = excluded.location,
          status = excluded.status, info = excluded.info, seen_at = excluded.seen_at`);
      for (const e of events) {
        const course = matchCourse(courses, e.summary);
        const subject = course?.name ?? e.summary;
        const old = get.get(user.id, e.uid, e.date, e.start) as { subject: string | null; status: string; info: string | null } | undefined;
        const status = e.cancelled ? 'cancelled' : 'normal';
        const info = e.cancelled ? 'abgesagt' : old && old.subject && old.subject !== subject ? `umbenannt: ${old.subject}` : e.location;
        if (!old || old.subject !== subject || old.status !== status) changed++;
        put.run(user.id, e.uid, e.date, e.start, e.end, subject, course?.id ?? null, e.location, status, info, stamp);
      }
      // Termine, die früher im Plan standen und jetzt fehlen (ab heute): entfallen
      const gone = db.prepare(`UPDATE ics_lessons SET status = 'cancelled', info = 'nicht mehr im Stundenplan' WHERE user_id = ? AND date >= ? AND date <= ? AND seen_at < ? AND status != 'cancelled'`).run(user.id, today, to, stamp);
      changed += gone.changes;
    })();
    db.prepare('UPDATE timetable_feeds SET last_run = ?, last_ok = ?, last_error = NULL, lessons = ? WHERE user_id = ?').run(stamp, stamp, events.length, user.id);
    return { lessons: events.length, changed };
  } catch (err) {
    const msg = (err as Error).message || 'Unbekannter Fehler';
    db.prepare('UPDATE timetable_feeds SET last_run = ?, last_error = ? WHERE user_id = ?').run(stamp, msg.slice(0, 300), user.id);
    throw err instanceof HttpError ? err : new HttpError(502, msg);
  }
}

/** Termine aus dem Abo als Unterricht (für das Lagebild, den Kalender und das Briefing) */
export function icsLessons(userId: string, from: string, to: string): Lesson[] {
  return db.prepare('SELECT date, start, end, subject, NULL AS code, status, info FROM ics_lessons WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, start')
    .all(userId, from, to) as Lesson[];
}

export const hasFeed = (userId: string) => hasSecret(userId, FEED_SECRET);

// ---------- Prüfungen und Abgaben mit Kurs ----------

export const courseOfItem = (userId: string, item: Pick<Item, 'subject'>): Course | null => (item.subject ? matchCourse(listCourses(userId), item.subject) : null);
