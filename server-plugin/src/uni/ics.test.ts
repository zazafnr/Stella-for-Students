import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from './ics.ts';

const wrap = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const ev = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
const TZ = 'Europe/Vienna';

test('Einzeltermin mit TZID, UTC und ohne Zone – alles in der Ortszeit der Person', () => {
  const ics = wrap(
    ev('UID:a', 'DTSTART;TZID=Europe/Vienna:20261105T101500', 'DTEND;TZID=Europe/Vienna:20261105T114500', 'SUMMARY:Analysis I\\, Vorlesung', 'LOCATION:HS 1'),
    ev('UID:b', 'DTSTART:20261105T130000Z', 'DTEND:20261105T140000Z', 'SUMMARY:Statistik'),
    ev('UID:c', 'DTSTART:20261106T080000', 'DTEND:20261106T093000', 'SUMMARY:Ohne Zone'),
    ev('UID:d', 'DTSTART;TZID=America/New_York:20261105T090000', 'DTEND;TZID=America/New_York:20261105T100000', 'SUMMARY:Anruf in New York'),
    ev('UID:e', 'DTSTART;VALUE=DATE:20261107', 'SUMMARY:Ganztägig (kein Unterricht)'),
  );
  const r = parseIcs(ics, TZ, '2026-11-01', '2026-11-30');
  const by = Object.fromEntries(r.map((x) => [x.uid, x]));
  assert.deepEqual([by.a!.date, by.a!.start, by.a!.end, by.a!.summary, by.a!.location], ['2026-11-05', '10:15', '11:45', 'Analysis I, Vorlesung', 'HS 1']);
  assert.deepEqual([by.b!.start, by.b!.end], ['14:00', '15:00'], '13:00 UTC = 14:00 in Wien (Winterzeit)');
  assert.deepEqual([by.c!.date, by.c!.start, by.c!.end], ['2026-11-06', '08:00', '09:30']);
  assert.deepEqual([by.d!.start, by.d!.end], ['15:00', '16:00'], '9 Uhr New York = 15 Uhr Wien');
  assert.equal(by.e, undefined, 'ganztägige Einträge gehören nicht in den Stundenplan');
});

test('Sommerzeit: dieselbe Vorlesung um 10 Uhr bleibt um 10 Uhr, UTC-Termine wandern', () => {
  const ics = wrap(
    ev('UID:w', 'DTSTART;TZID=Europe/Vienna:20260323T100000', 'DTEND;TZID=Europe/Vienna:20260323T113000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Vorlesung'),
    ev('UID:u', 'DTSTART:20260323T090000Z', 'DTEND:20260323T103000Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:UTC-Serie'),
  );
  const r = parseIcs(ics, TZ, '2026-03-01', '2026-04-30');
  const w = r.filter((x) => x.uid === 'w');
  assert.deepEqual(w.map((x) => [x.date, x.start]), [['2026-03-23', '10:00'], ['2026-03-30', '10:00'], ['2026-04-06', '10:00']]);
  const u = r.filter((x) => x.uid === 'u');
  assert.deepEqual(u.map((x) => [x.date, x.start]), [['2026-03-23', '10:00'], ['2026-03-30', '11:00'], ['2026-04-06', '11:00']], 'nach der Umstellung am 29.3. verschiebt sich eine feste UTC-Zeit');
});

test('wöchentliche Serie: BYDAY, INTERVAL, UNTIL, COUNT, EXDATE und geänderter Einzeltermin', () => {
  const ics = wrap(
    ev('UID:s', 'DTSTART;TZID=Europe/Vienna:20261102T080000', 'DTEND;TZID=Europe/Vienna:20261102T093000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261118T000000Z', 'EXDATE;TZID=Europe/Vienna:20261111T080000', 'SUMMARY:Mathe'),
    ev('UID:s', 'RECURRENCE-ID;TZID=Europe/Vienna:20261116T080000', 'DTSTART;TZID=Europe/Vienna:20261116T140000', 'DTEND;TZID=Europe/Vienna:20261116T153000', 'SUMMARY:Mathe (verlegt)'),
    ev('UID:z', 'DTSTART;TZID=Europe/Vienna:20261103T120000', 'DTEND;TZID=Europe/Vienna:20261103T130000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3', 'SUMMARY:Übung'),
    ev('UID:x', 'DTSTART;TZID=Europe/Vienna:20261110T160000', 'DTEND;TZID=Europe/Vienna:20261110T170000', 'STATUS:CANCELLED', 'SUMMARY:Tutorium'),
  );
  const r = parseIcs(ics, TZ, '2026-11-01', '2026-12-31');
  const mathe = r.filter((x) => x.uid === 's').map((x) => [x.date, x.start, x.summary]);
  assert.deepEqual(mathe, [['2026-11-02', '08:00', 'Mathe'], ['2026-11-04', '08:00', 'Mathe'], ['2026-11-09', '08:00', 'Mathe'], ['2026-11-16', '14:00', 'Mathe (verlegt)'], ['2026-11-18', '08:00', 'Mathe']],
    'der 11.11. fällt per EXDATE aus, der 16.11. ist verlegt, nach UNTIL (18.11.) ist Schluss');
  assert.deepEqual(r.filter((x) => x.uid === 'z').map((x) => x.date), ['2026-11-03', '2026-11-17', '2026-12-01'], 'alle zwei Wochen, dreimal');
  assert.equal(r.find((x) => x.uid === 'x')!.cancelled, true);
});

test('Zeitraum, Zeilenumbrüche und kaputte Eingaben', () => {
  const long = 'SUMMARY:' + 'Sehr langer Titel '.repeat(10);
  const ics = wrap(ev('UID:l', 'DTSTART:20261201T100000Z', 'DTEND:20261201T110000Z', long.slice(0, 60) + '\r\n ' + long.slice(60)));
  const r = parseIcs(ics, TZ, '2026-12-01', '2026-12-01');
  assert.equal(r.length, 1);
  assert.equal(r[0]!.summary, ('Sehr langer Titel '.repeat(10)).trim());
  assert.deepEqual(parseIcs(ics, TZ, '2026-12-02', '2026-12-31'), []);
  assert.deepEqual(parseIcs('kein Kalender', TZ, '2026-01-01', '2026-12-31'), []);
  assert.deepEqual(parseIcs(wrap(ev('UID:k', 'DTSTART:quatsch', 'SUMMARY:x')), TZ, '2026-01-01', '2026-12-31'), []);
});
