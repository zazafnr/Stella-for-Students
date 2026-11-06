import { addDays, type Item } from '@stella/shared';
import { dayFor, tr, type EditionPlugin, type Lagebild, type User } from '../runtime.ts';
import { courseOfItem, gradeAverage, listCourses, listGrades, listTerms, icsLessons } from './uni.ts';

type Hint = ReturnType<NonNullable<EditionPlugin['hints']>>[number];

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Hinweise zur Uni: Vorlesung entfällt, Anmeldefrist läuft ab, Abgabe bald und kein Lernblock geplant */
export function uniHints(user: User, lb: Lagebild): Hint[] {
  const out: Hint[] = [];
  const today = lb.today;
  const tomorrow = addDays(today, 1);

  // Vorlesung entfällt morgen (laut ICS-Abo)
  for (const l of icsLessons(user.id, tomorrow, tomorrow).filter((x) => x.status === 'cancelled')) {
    out.push({ key: `uni_cancel:${l.date}:${l.start}:${l.subject}`, priority: 'high', text: tr(user, 'students.hint.cancelled', { subject: l.subject ?? '', time: l.start }) });
  }

  const items = lb.days.flatMap((d) => d.items).filter((i) => i.status === 'open');

  // Anmeldefrist läuft bald ab
  for (const i of items.filter((x) => x.kind === 'todo' && x.title.startsWith('Anmeldung:') && x.due)) {
    const days = daysBetween(today, i.due!);
    if (days < 0 || days > 3) continue;
    out.push({ key: `uni_register:${i.id}`, priority: days <= 1 ? 'high' : 'normal', itemId: i.id, text: tr(user, 'students.hint.register', { title: i.title.replace(/^Anmeldung:\s*/, ''), when: dayFor(user, i.due!, today) }) });
  }

  // Abgabe in höchstens zwei Tagen, aber kein Lernblock dafür
  const studyBlocks = lb.days.flatMap((d) => d.items).filter((i) => i.kind === 'study' && i.status === 'open');
  for (const i of items.filter((x) => x.kind === 'assignment' && x.due && courseOfItem(user.id, x))) {
    const days = daysBetween(today, i.due!);
    if (days < 0 || days > 2) continue;
    if (studyBlocks.some((s) => s.parentId === i.id || (s.subject && s.subject === i.subject && s.due! <= i.due!))) continue;
    out.push({ key: `uni_assignment:${i.id}`, priority: 'high', itemId: i.id, text: tr(user, 'students.hint.assignment', { title: i.title, when: dayFor(user, i.due!, today) }), open: { tab: 'chat', label: tr(user, 'students.hint.assignment.open') } });
  }
  return out;
}

/** Zusätzliche Erinnerung: Abgaben von Kursen eine Woche vorher (Kern: 3 Tage und 1 Tag vorher) */
export function uniReminders(user: User, item: Item): { date: string; time: string; message: string }[] {
  if (item.kind !== 'assignment' || !item.due || !courseOfItem(user.id, item)) return [];
  const date = addDays(item.due, -7);
  return [{ date, time: user.settings.studyTime ?? '16:30', message: tr(user, 'students.assignment.inAWeek', { title: item.title }) }];
}

/** Werkzeug „Wie steht mein Schnitt?“ */
export function gradeSummary(user: User) {
  const avg = gradeAverage(user.id);
  const courses = new Map(listCourses(user.id).map((c) => [c.id, c]));
  const perCourse = new Map<string, { sum: number; weight: number; n: number }>();
  for (const g of listGrades(user.id)) {
    const c = g.courseId ? courses.get(g.courseId) : null;
    const key = c?.name ?? '–';
    const w = g.weight ?? c?.ects ?? 1;
    const cur = perCourse.get(key) ?? { sum: 0, weight: 0, n: 0 };
    cur.sum += g.grade * w; cur.weight += w; cur.n++;
    perCourse.set(key, cur);
  }
  return {
    average: avg.average, gradeCount: avg.count, ects: avg.ects, terms: listTerms(user.id).length,
    note: 'Gewichteter Schnitt nach ECTS (oder dem Gewicht der Note). Keine Prognose, keine Bewertung: je nach Land ist die kleinste oder die größte Zahl die beste Note.',
    perCourse: [...perCourse].map(([course, v]) => ({ course, average: Math.round((v.sum / v.weight) * 100) / 100, grades: v.n })),
  };
}

