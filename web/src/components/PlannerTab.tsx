import { useState } from 'react';
import { CalendarView } from '@stella/web-core/calendar/CalendarView.tsx';
import { useT } from '@stella/web-core/i18n.ts';
import { Planner } from './Planner.tsx';

const MODE_KEY = 'students.plannerMode';
const readMode = (): 'list' | 'calendar' => { try { return localStorage.getItem(MODE_KEY) === 'calendar' ? 'calendar' : 'list'; } catch { return 'list'; } };

/** Planer der Students-App: Wochenbrett mit Fächerfarben (Standard) – und der Kalender aus web-core als zweite Ansicht. */
export function PlannerTab() {
  const t = useT();
  const [mode, setModeState] = useState(readMode);
  const setMode = (m: 'list' | 'calendar') => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* ohne Speicher geht es auch */ } };
  const switcher = (
    <div className="segmented" role="tablist" aria-label={t('nav.planner')}>
      <button type="button" role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>{t('calendar.listView')}</button>
      <button type="button" role="tab" aria-selected={mode === 'calendar'} className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')}>{t('calendar.calendarView')}</button>
    </div>
  );
  if (mode === 'calendar') return <CalendarView storagePrefix="students" trailing={switcher} />;
  return (
    <>
      <div className="cal-modebar">{switcher}</div>
      <Planner />
    </>
  );
}
