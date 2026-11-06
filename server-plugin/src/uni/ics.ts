// Minimaler iCalendar-Leser für Uni-Stundenpläne (VEVENT mit DTSTART/DTEND, TZID, UTC, wöchentliche Wiederholung, EXDATE, RECURRENCE-ID, STATUS:CANCELLED).
// Ausgabe: Termine in der Ortszeit der Person (Datum + HH:MM). Keine Netzwerk-Aufrufe – rein und gut testbar.

import { addDays, zonedToUtc } from '@stella/shared';

export interface IcsEvent { uid: string; date: string; start: string; end: string; summary: string; location: string | null; description: string | null; cancelled: boolean }

interface RawEvent { props: Map<string, { value: string; params: Record<string, string> }[]> }

const unfold = (text: string) => text.replace(/\r?\n[ \t]/g, '');

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const idx = (() => { let q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') q = !q; else if (c === ':' && !q) return i; } return -1; })();
  if (idx < 0) return null;
  const [name, ...ps] = line.slice(0, idx).split(';');
  const params: Record<string, string> = {};
  for (const p of ps) { const [k, v] = p.split('='); if (k && v !== undefined) params[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
  return { name: name!.toUpperCase(), params, value: line.slice(idx + 1) };
}

const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function events(text: string): RawEvent[] {
  const out: RawEvent[] = [];
  let cur: RawEvent | null = null;
  for (const line of unfold(text).split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') cur = { props: new Map() };
    else if (line === 'END:VEVENT') { if (cur) out.push(cur); cur = null; }
    else if (cur) {
      const p = parseLine(line);
      if (p) { const list = cur.props.get(p.name) ?? []; list.push({ value: p.value, params: p.params }); cur.props.set(p.name, list); }
    }
  }
  return out;
}

export interface Stamp { utc: Date; /** Zone, in der der Termin definiert ist (UTC bei „Z“) */ tz: string; ymd: string; hhmm: string }

/** „20261105T101500Z“ / „20261105T101500“ mit TZID → Zeitpunkt samt Quell-Zone; `null` bei ganztägig oder kaputt */
export function parseStamp(value: string, params: Record<string, string>, userTz: string): Stamp | null {
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value.trim());
  if (!m) return null;
  const ymd = `${m[1]}-${m[2]}-${m[3]}`;
  const hhmm = `${m[4]}:${m[5]}`;
  if (m[7]) return { utc: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))), tz: 'UTC', ymd, hhmm };
  const tz = params.TZID && isTimeZone(params.TZID) ? params.TZID : userTz; // unbekannte Zone: wie Ortszeit der Person
  return { utc: zonedToUtc(ymd, hhmm, tz), tz, ymd, hhmm };
}

const localOf = (utc: Date, tz: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(utc);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};

/** Zeitstempel → Datum und Uhrzeit in der Ortszeit der Person */
export function toLocal(value: string, params: Record<string, string>, userTz: string): { date: string; time: string } | null {
  const st = parseStamp(value, params, userTz);
  return st ? localOf(st.utc, userTz) : null;
}

function isTimeZone(tz: string): boolean { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }

const WEEKDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const dow = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

interface Rule { freq: 'DAILY' | 'WEEKLY'; interval: number; count: number | null; until: string | null; byday: number[] }

function parseRule(v: string, userTz: string): Rule | null {
  const kv = Object.fromEntries(v.split(';').map((p) => p.split('=') as [string, string]));
  if (kv.FREQ !== 'WEEKLY' && kv.FREQ !== 'DAILY') return null;
  let until: string | null = null;
  if (kv.UNTIL) { const l = toLocal(kv.UNTIL.length === 8 ? `${kv.UNTIL}T235959` : kv.UNTIL, {}, userTz); until = l?.date ?? `${kv.UNTIL.slice(0, 4)}-${kv.UNTIL.slice(4, 6)}-${kv.UNTIL.slice(6, 8)}`; }
  return { freq: kv.FREQ, interval: Math.max(1, Number(kv.INTERVAL) || 1), count: kv.COUNT ? Number(kv.COUNT) : null, until, byday: (kv.BYDAY ?? '').split(',').map((d) => WEEKDAY[d.slice(-2)]).filter((d): d is number => d !== undefined) };
}

const addMinutes = (hhmm: string, min: number) => { const [h, m] = hhmm.split(':').map(Number); const t = Math.max(0, Math.min(24 * 60 - 1, h! * 60 + m! + min)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

/** Alle Termine zwischen `from` und `to` (einschließlich), wiederholte Termine aufgelöst. Höchstens 2000 Termine. */
export function parseIcs(text: string, userTz: string, from: string, to: string): IcsEvent[] {
  const raws = events(text);
  const first = (e: RawEvent, n: string) => e.props.get(n)?.[0];
  const overrides = new Set<string>();
  const out: IcsEvent[] = [];
  const push = (e: RawEvent, date: string, start: string, end: string) => {
    if (date < from || date > to || out.length >= 2000) return;
    out.push({
      uid: first(e, 'UID')?.value ?? `${date}${start}${first(e, 'SUMMARY')?.value ?? ''}`, date, start, end, summary: unescape(first(e, 'SUMMARY')?.value ?? '').trim(),
      location: unescape(first(e, 'LOCATION')?.value ?? '').trim() || null, description: unescape(first(e, 'DESCRIPTION')?.value ?? '').trim() || null,
      cancelled: (first(e, 'STATUS')?.value ?? '').toUpperCase() === 'CANCELLED',
    });
  };
  const bounds = (e: RawEvent) => {
    const s = first(e, 'DTSTART'); const en = first(e, 'DTEND');
    if (!s) return null;
    const a = parseStamp(s.value, s.params, userTz);
    if (!a) return null;
    const b = en ? parseStamp(en.value, en.params, userTz) : null;
    const real = b ? Math.round((b.utc.getTime() - a.utc.getTime()) / 60_000) : 60;
    const local = localOf(a.utc, userTz);
    return { date: local.date, start: local.time, duration: real >= 5 && real <= 24 * 60 ? real : 60, src: a };
  };

  // geänderte Einzeltermine (RECURRENCE-ID) ersetzen den Termin der Serie an diesem Tag
  for (const e of raws) {
    const rid = first(e, 'RECURRENCE-ID');
    if (!rid) continue;
    const l = toLocal(rid.value, rid.params, userTz);
    const uid = first(e, 'UID')?.value;
    if (l && uid) overrides.add(`${uid}|${l.date}`);
    const b = bounds(e);
    if (b) push(e, b.date, b.start, addMinutes(b.start, b.duration));
  }
  for (const e of raws) {
    if (first(e, 'RECURRENCE-ID')) continue;
    const b = bounds(e);
    if (!b) continue;
    const uid = first(e, 'UID')?.value ?? '';
    const rr = first(e, 'RRULE');
    if (!rr) { push(e, b.date, b.start, addMinutes(b.start, b.duration)); continue; }
    const rule = parseRule(rr.value, userTz);
    if (!rule) { push(e, b.date, b.start, addMinutes(b.start, b.duration)); continue; }
    const ex = new Set((e.props.get('EXDATE') ?? []).flatMap((x) => x.value.split(',').map((v) => toLocal(v, x.params, userTz)?.date).filter((d): d is string => !!d)));
    // Die Serie läuft in der Zone, in der sie definiert ist (UTC-Serien wandern mit der Sommerzeit, TZID-Serien nicht)
    const src = b.src;
    const days = rule.byday.length ? rule.byday : [dow(src.ymd)];
    let n = 0;
    const startWeek = addDays(src.ymd, -((dow(src.ymd) + 6) % 7)); // Montag der Startwoche
    for (let day = src.ymd; day <= addDays(to, 2) && n < 3000; day = addDays(day, 1)) {
      if (rule.until && day > rule.until) break;
      const weekIdx = Math.floor((Date.parse(`${addDays(day, -((dow(day) + 6) % 7))}T12:00:00Z`) - Date.parse(`${startWeek}T12:00:00Z`)) / (7 * 86_400_000));
      const hit = rule.freq === 'DAILY'
        ? Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${src.ymd}T12:00:00Z`)) / 86_400_000) % rule.interval === 0
        : days.includes(dow(day)) && weekIdx % rule.interval === 0;
      if (!hit) continue;
      n++;
      if (rule.count && n > rule.count) break;
      const at = zonedToUtc(day, src.hhmm, src.tz);
      const local = localOf(at, userTz);
      if (ex.has(day) || ex.has(local.date) || overrides.has(`${uid}|${local.date}`)) continue;
      push(e, local.date, local.time, addMinutes(local.time, b.duration));
    }
  }
  return out.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}
