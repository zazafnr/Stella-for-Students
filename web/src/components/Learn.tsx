import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { addDays, diffDays, formatDay, todayIn, type Item } from '@stella/shared';
import { api, useStore } from '@stella/web-core/store.ts';
import { useT, useLocale } from '@stella/web-core/i18n.ts';
import { Icon } from '@stella/web-core/ui/Icon.tsx';
import { subjectColor } from '../subjectColor.ts';
import { Cards } from './Cards.tsx';
import { Notes } from './Notes.tsx';

/** „Lernen“: Lernplan der Woche, Prüfungen mit Stoff und Lernstand; Lernkarten und Mitschriften füllen sich in den nächsten Paketen. */
export function Learn() {
  const locale = useLocale();
  const t = useT();
  const items = useStore((s) => s.items);
  const tz = useStore((s) => s.me?.timeZone) ?? 'Europe/Vienna';
  const today = todayIn(tz);
  const [avg, setAvg] = useState<{ average: number | null; count: number; ects: number } | null>(null);
  useEffect(() => { void api<{ average: number | null; count: number; ects: number }>('/api/students/grades/average').then(setAvg).catch(() => {}); }, []);

  const all = useMemo(() => Object.values(items).filter((i) => !i.deleted && i.status !== 'cancelled'), [items]);
  const sessions = useMemo(
    () => all.filter((i) => i.kind === 'study' && i.due && i.due >= today && i.due < addDays(today, 7)).sort((a, b) => `${a.due} ${a.time ?? ''}`.localeCompare(`${b.due} ${b.time ?? ''}`)),
    [all, today],
  );
  const exams = useMemo(() => all.filter((i) => i.kind === 'exam' && i.status === 'open' && i.due && i.due >= today).sort((a, b) => a.due!.localeCompare(b.due!)), [all, today]);

  const style = (subject: string | null): CSSProperties => ({ '--subject': subjectColor(subject) } as CSSProperties);
  const doneOf = (exam: Item) => {
    const own = all.filter((i) => i.kind === 'study' && i.parentId === exam.id);
    return { total: own.length, done: own.filter((i) => i.status === 'done').length };
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="display">{t('nav.learn')}</h1>
          </div>
        </header>

        <section className="learn-section" aria-labelledby="learn-week">
          <h2 id="learn-week">{t('learn.week.title')}</h2>
          {sessions.length === 0 && <p className="muted">{t('learn.week.empty')}</p>}
          {sessions.map((s) => (
            <div key={s.id} className="learn-row" style={style(s.subject)}>
              <span className="when">{s.due === today ? t('learn.week.today') : formatDay(locale, s.due!, today)}{s.time ? ` · ${s.time}` : ''}</span>
              <span style={{ flex: 1 }}>{s.detail ?? s.title}</span>
              {s.status === 'done' && <Icon name="check" size={16} stroke={3} />}
            </div>
          ))}
        </section>

        <section className="learn-section" aria-labelledby="learn-exams">
          <h2 id="learn-exams">{t('learn.exams.title')}</h2>
          {exams.length === 0 && <p className="muted">{t('learn.exams.none')}</p>}
          {exams.map((e) => {
            const n = diffDays(today, e.due!);
            const { total, done } = doneOf(e);
            return (
              <div key={e.id} className="learn-row" style={{ ...style(e.subject), flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
                  <strong style={{ flex: 1 }}>{e.title}</strong>
                  <span className="pill deadline">{n === 0 ? t('learn.exams.today') : t('learn.exams.daysLeft', { count: n })}</span>
                </div>
                <span className="small muted">{e.material?.trim() ? e.material : t('learn.exams.noMaterial')}</span>
                {total > 0 && <span className="small">{t('learn.exams.sessions', { done, total })}</span>}
              </div>
            );
          })}
        </section>

        {avg && avg.count > 0 && (
          <section className="learn-section" aria-labelledby="learn-grades">
            <h2 id="learn-grades">{t('uni.grades')}</h2>
            <div className="learn-row"><strong style={{ fontSize: 22 }}>{avg.average?.toLocaleString()}</strong><span className="muted" style={{ flex: 1 }}>{t('uni.average')} · {t('uni.ects', { count: avg.ects })}</span></div>
          </section>
        )}

        <section className="learn-section" aria-labelledby="learn-cards">
          <h2 id="learn-cards">{t('learn.cards.title')}</h2>
          <Cards />
        </section>

        <section className="learn-section" aria-labelledby="learn-notes">
          <h2 id="learn-notes">{t('learn.notes.title')}</h2>
          <Notes />
        </section>
      </div>
    </div>
  );
}
