import type { FastifyInstance, FastifyRequest } from 'fastify';
import { addDays } from '@stella/shared';
import { addItem, getUser, HttpError } from '../runtime.ts';
import {
  deleteCourse, deleteGrade, deleteTerm, feedState, getCourse, gradeAverage, listCourses, listGrades, listTerms, refreshTimetable, removeFeed, saveCourse, saveFeed, saveGrade, saveTerm,
} from './uni.ts';

const body = (req: FastifyRequest) => ((req.body ?? {}) as Record<string, unknown>);
const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const hhmm = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
type Params = { Params: { id: string } };

export function registerUniRoutes(api: FastifyInstance) {
  // alles für die Uni-Einstellungen und den Lernen-Tab auf einmal
  api.get('/api/students/uni', async (req) => ({
    terms: listTerms(req.user.id), courses: listCourses(req.user.id), grades: listGrades(req.user.id), average: gradeAverage(req.user.id), timetable: feedState(req.user.id),
  }));

  api.post('/api/students/terms', async (req) => saveTerm(req.user.id, body(req)));
  api.patch<Params>('/api/students/terms/:id', async (req) => saveTerm(req.user.id, body(req), req.params.id));
  api.delete<Params>('/api/students/terms/:id', async (req) => { if (!deleteTerm(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });

  api.post('/api/students/courses', async (req) => saveCourse(req.user.id, body(req)));
  api.patch<Params>('/api/students/courses/:id', async (req) => saveCourse(req.user.id, body(req), req.params.id));
  api.delete<Params>('/api/students/courses/:id', async (req) => { if (!deleteCourse(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });

  api.post('/api/students/grades', async (req) => saveGrade(req.user.id, body(req)));
  api.patch<Params>('/api/students/grades/:id', async (req) => saveGrade(req.user.id, body(req), req.params.id));
  api.delete<Params>('/api/students/grades/:id', async (req) => { if (!deleteGrade(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });
  api.get('/api/students/grades/average', async (req) => gradeAverage(req.user.id));

  // Stundenplan-Abo: nur https, nur öffentliche Adressen; Fehler stehen sichtbar im Zustand
  api.put('/api/students/timetable/ics', async (req) => {
    const url = typeof body(req).url === 'string' ? (body(req).url as string) : '';
    await saveFeed(req.user.id, url);
    try { await refreshTimetable(getUser(req.user.id)!); } catch { /* der Fehler steht im Zustand (lastError) */ }
    return feedState(req.user.id);
  });
  api.delete('/api/students/timetable/ics', async (req) => { removeFeed(req.user.id); return feedState(req.user.id); });
  api.post('/api/students/timetable/refresh', async (req) => {
    try { const r = await refreshTimetable(getUser(req.user.id)!); return { ...r, timetable: feedState(req.user.id) }; }
    catch (err) { throw new HttpError(err instanceof HttpError ? err.status : 502, (err as Error).message); }
  });

  // Prüfungstermin mit Kurs, Ort und Anmeldefrist (eigene Erinnerung)
  api.post('/api/students/exams', async (req) => {
    const b = body(req);
    const course = typeof b.courseId === 'string' ? getCourse(req.user.id, b.courseId) : null;
    const date = ymd(b.date);
    if (!course) throw new HttpError(400, 'Bitte einen Kurs wählen.');
    if (!date) throw new HttpError(400, 'Das Datum der Prüfung fehlt.');
    const exam = addItem(req.user, {
      kind: 'exam', subject: course.name, title: typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 120) : course.name,
      due: date, time: hhmm(b.time), location: typeof b.location === 'string' ? b.location.trim().slice(0, 120) || null : course.location, source: 'uni',
    });
    let registration = null;
    const registerBy = ymd(b.registerBy);
    if (registerBy) registration = addItem(req.user, { kind: 'todo', subject: course.name, title: `Anmeldung: ${exam.title}`, detail: `Anmeldefrist für ${exam.title}`, due: registerBy, parentId: exam.id, source: 'uni' });
    return { exam, registration };
  });

  // Abgabefrist mit Kurs: Erinnerungen 7 / 3 / 1 Tag vorher (Kern + Plugin), Lernblöcke plant der Wochenplan
  api.post('/api/students/assignments', async (req) => {
    const b = body(req);
    const course = typeof b.courseId === 'string' ? getCourse(req.user.id, b.courseId) : null;
    const due = ymd(b.due);
    const title = typeof b.title === 'string' ? b.title.trim().slice(0, 120) : '';
    if (!course) throw new HttpError(400, 'Bitte einen Kurs wählen.');
    if (!due || due < addDays(due, 0)) throw new HttpError(400, 'Das Datum der Abgabe fehlt.');
    if (!title) throw new HttpError(400, 'Der Titel der Abgabe fehlt.');
    return { assignment: addItem(req.user, { kind: 'assignment', subject: course.name, title, due, time: hhmm(b.time), source: 'uni' }) };
  });
}
