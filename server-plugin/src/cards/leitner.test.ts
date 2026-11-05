import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, INTERVALS, isDue, newCard } from './leitner.ts';

test('Stufen und Abstände: 1 → 3 → 7 → 16 → 35 Tage', () => {
  assert.deepEqual([...INTERVALS], [1, 3, 7, 16, 35]);
  let s = newCard('2026-11-05');
  assert.deepEqual(s, { stage: 1, due: '2026-11-05' }, 'neue Karte ist heute dran');
  s = answer(s, true, '2026-11-05'); assert.deepEqual(s, { stage: 2, due: '2026-11-08' });
  s = answer(s, true, '2026-11-08'); assert.deepEqual(s, { stage: 3, due: '2026-11-15' });
  s = answer(s, true, '2026-11-15'); assert.deepEqual(s, { stage: 4, due: '2026-12-01' });
  s = answer(s, true, '2026-12-01'); assert.deepEqual(s, { stage: 5, due: '2027-01-05' });
  s = answer(s, true, '2027-01-05'); assert.deepEqual(s, { stage: 5, due: '2027-02-09' }, 'höher als Stufe 5 geht es nicht');
});

test('falsch setzt auf Stufe 1 zurück – morgen wieder dran', () => {
  const s = answer({ stage: 4, due: '2026-12-01' }, false, '2026-12-01');
  assert.deepEqual(s, { stage: 1, due: '2026-12-02' });
});

test('Fälligkeit über Monats-, Jahres- und Zeitumstellungs-Grenzen hinweg (Kalendertage, keine Stunden)', () => {
  assert.deepEqual(answer({ stage: 2, due: '2026-12-29' }, true, '2026-12-29'), { stage: 3, due: '2027-01-05' });
  // Zeitumstellung in Wien: 29.3.2026 – der Tag hat 23 Stunden, die Karte ist trotzdem genau 3 Tage später dran
  assert.deepEqual(answer({ stage: 1, due: '2026-03-28' }, true, '2026-03-28'), { stage: 2, due: '2026-03-31' });
  assert.deepEqual(answer({ stage: 1, due: '2026-10-24' }, true, '2026-10-24'), { stage: 2, due: '2026-10-27' });
  assert.equal(isDue({ stage: 2, due: '2026-11-05' }, '2026-11-05'), true);
  assert.equal(isDue({ stage: 2, due: '2026-11-06' }, '2026-11-05'), false);
  assert.equal(isDue({ stage: 3, due: '2026-11-01' }, '2026-11-05'), true, 'überfällige Karten bleiben dran');
});
