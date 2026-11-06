import { useCallback, useEffect, useState } from 'react';
import { api } from '@stella/web-core/store.ts';
import { useT } from '@stella/web-core/i18n.ts';
import { Section, useAction } from '@stella/web-core/components/settings/ui.tsx';
import { subjectColor } from '../../subjectColor.ts';

interface Term { id: string; name: string; from: string; to: string }
interface Course { id: string; name: string; code: string | null; lecturer: string | null; ects: number | null; color: string | null; termId: string | null }
interface Grade { id: string; courseId: string | null; title: string | null; grade: number; weight: number | null; date: string | null }
interface Feed { url: string | null; lastRun: string | null; lastOk: string | null; lastError: string | null; lessons: number }
interface Uni { terms: Term[]; courses: Course[]; grades: Grade[]; average: { average: number | null; count: number; ects: number }; timetable: Feed }

/** Uni: Semester, Kurse, Stundenplan-Abo (ICS) und Noten – alles auf einer Seite in den Einstellungen. */
export function UniSettings() {
  const t = useT();
  const [data, setData] = useState<Uni | null>(null);
  const [run] = useAction();
  const load = useCallback(() => { void api<Uni>('/api/students/uni').then(setData).catch(() => {}); }, []);
  useEffect(load, [load]);
  const [term, setTerm] = useState({ name: '', from: '', to: '' });
  const [course, setCourse] = useState({ name: '', code: '', lecturer: '', ects: '' });
  const [grade, setGrade] = useState({ courseId: '', grade: '', title: '' });
  const [url, setUrl] = useState('');
  if (!data) return null;
  const act = (fn: () => Promise<unknown>, ok = t('uni.saved')) => run(async () => { await fn(); load(); }, ok);
  const feed = data.timetable;

  return (
    <>
      <Section title={t('uni.terms')}>
        {data.terms.map((x) => (
          <div key={x.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span><strong>{x.name}</strong> <span className="muted small">{x.from} – {x.to}</span></span>
            <button type="button" className="link danger small" onClick={() => act(() => api(`/api/students/terms/${x.id}`, { method: 'DELETE' }))}>{t('uni.delete')}</button>
          </div>
        ))}
        <form className="form-grid two" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api('/api/students/terms', { method: 'POST', json: term }); setTerm({ name: '', from: '', to: '' }); }); }}>
          <label>{t('uni.term.name')}<input value={term.name} onChange={(e) => setTerm({ ...term, name: e.target.value })} required /></label>
          <label>{t('uni.term.from')}<input type="date" value={term.from} onChange={(e) => setTerm({ ...term, from: e.target.value })} required /></label>
          <label>{t('uni.term.to')}<input type="date" value={term.to} onChange={(e) => setTerm({ ...term, to: e.target.value })} required /></label>
          <button type="submit" className="btn secondary">{t('uni.term.add')}</button>
        </form>
      </Section>

      <Section title={t('uni.courses')}>
        {data.courses.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span><span className="subject-dot" style={{ background: c.color ?? subjectColor(c.name) }} /><strong>{c.name}</strong>{c.code ? <span className="muted small"> · {c.code}</span> : null}{c.ects ? <span className="muted small"> · {c.ects} ECTS</span> : null}{c.lecturer ? <span className="muted small"> · {c.lecturer}</span> : null}</span>
            <button type="button" className="link danger small" onClick={() => act(() => api(`/api/students/courses/${c.id}`, { method: 'DELETE' }))}>{t('uni.delete')}</button>
          </div>
        ))}
        <form className="form-grid two" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api('/api/students/courses', { method: 'POST', json: { ...course, termId: data.terms[0]?.id } }); setCourse({ name: '', code: '', lecturer: '', ects: '' }); }); }}>
          <label>{t('uni.course.name')}<input value={course.name} onChange={(e) => setCourse({ ...course, name: e.target.value })} required /></label>
          <label>{t('uni.course.code')}<input value={course.code} onChange={(e) => setCourse({ ...course, code: e.target.value })} /></label>
          <label>{t('uni.course.lecturer')}<input value={course.lecturer} onChange={(e) => setCourse({ ...course, lecturer: e.target.value })} /></label>
          <label>{t('uni.course.ects')}<input inputMode="decimal" value={course.ects} onChange={(e) => setCourse({ ...course, ects: e.target.value })} /></label>
          <button type="submit" className="btn secondary">{t('uni.course.add')}</button>
        </form>
      </Section>

      <Section title={t('uni.timetable')}>
        <p className="muted">{t('uni.timetable.help')}</p>
        {feed.url && <p className="small" style={{ wordBreak: 'break-all' }}>{feed.url}</p>}
        {feed.lastOk && !feed.lastError && <p className="small muted">{t('uni.timetable.lastOk', { when: new Date(feed.lastOk).toLocaleString(), count: feed.lessons })}</p>}
        {feed.lastError && <p className="error-text small" role="alert">{t('uni.timetable.error', { error: feed.lastError })}</p>}
        <form className="button-row" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api('/api/students/timetable/ics', { method: 'PUT', json: { url } }); setUrl(''); }); }}>
          <input type="url" inputMode="url" placeholder={t('uni.timetable.url')} value={url} onChange={(e) => setUrl(e.target.value)} required={!feed.url} style={{ flex: 1, minWidth: 200 }} />
          <button type="submit" className="btn">{t('uni.timetable.save')}</button>
        </form>
        {feed.url && (
          <div className="button-row">
            <button type="button" className="btn secondary" onClick={() => act(() => api('/api/students/timetable/refresh', { method: 'POST' }), t('uni.timetable.refreshed'))}>{t('uni.timetable.refresh')}</button>
            <button type="button" className="link danger" onClick={() => act(() => api('/api/students/timetable/ics', { method: 'DELETE' }))}>{t('uni.timetable.remove')}</button>
          </div>
        )}
      </Section>

      <Section title={t('uni.grades')}>
        <p><strong>{t('uni.average')}:</strong> {data.average.average === null ? t('uni.average.none') : `${data.average.average.toLocaleString()} · ${t('uni.ects', { count: data.average.ects })}`}</p>
        {data.grades.map((g) => (
          <div key={g.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span><strong>{g.grade.toLocaleString()}</strong> <span className="muted small">{data.courses.find((c) => c.id === g.courseId)?.name ?? g.title ?? ''}{g.date ? ` · ${g.date}` : ''}</span></span>
            <button type="button" className="link danger small" onClick={() => act(() => api(`/api/students/grades/${g.id}`, { method: 'DELETE' }))}>{t('uni.delete')}</button>
          </div>
        ))}
        <form className="form-grid two" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api('/api/students/grades', { method: 'POST', json: { courseId: grade.courseId || null, grade: grade.grade, title: grade.title } }); setGrade({ courseId: '', grade: '', title: '' }); }); }}>
          <label>{t('uni.course.name')}<select value={grade.courseId} onChange={(e) => setGrade({ ...grade, courseId: e.target.value })}><option value="">{t('uni.course.none')}</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>{t('uni.grade.value')}<input inputMode="decimal" value={grade.grade} onChange={(e) => setGrade({ ...grade, grade: e.target.value })} required /></label>
          <label>{t('uni.grade.title')}<input value={grade.title} onChange={(e) => setGrade({ ...grade, title: e.target.value })} /></label>
          <button type="submit" className="btn secondary">{t('uni.grade.add')}</button>
        </form>
      </Section>
    </>
  );
}
