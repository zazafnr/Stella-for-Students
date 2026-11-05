import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-students-core-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.OPENROUTER_API_KEY = '';
process.env.STELLA_ALLOW_REGISTRATION = 'true';

const { register } = await import('../../core/server/src/auth.ts');
const { getUser, updateUserSettings } = await import('../../core/server/src/db.ts');
const { loadEditions } = await import('../../core/server/src/editions/load.ts');
const { pluginAutomations, pluginParser, pluginTools, pluginActionGroups } = await import('../../core/server/src/editions/registry.ts');
const { levelFor } = await import('../../core/server/src/actions.ts');
const { quickActions } = await import('../../core/server/src/quick.ts');
const { systemPrompt } = await import('../../core/server/src/assistant.ts');
const { interpret, todayIn } = await import('@stella/shared');

const res = await loadEditions(path.resolve(import.meta.dirname, '..'));

const mk = (name: string, profile: Parameters<typeof updateUserSettings>[1]['profile']) => {
  const { user } = register(name, `${name.toLowerCase()}@example.com`, 'supergeheim', 'Europe/Vienna');
  updateUserSettings(user.id, { locale: 'de', country: 'AT', profile });
  return user.id;
};
const school = mk('Lukas', { situation: 'school', features: ['planner', 'homework', 'mails'] });
const job = mk('Mia', { situation: 'work', features: ['planner', 'mails', 'shopping', 'goals'] });

test('das Plugin hängt sich als „students“ ein', () => {
  assert.deepEqual(res.loaded, ['students']);
  assert.deepEqual(pluginTools(getUser(school)!).map((t) => t.def.function.name), ['solve_homework', 'timetable']);
  assert.deepEqual(Object.keys(pluginActionGroups()), ['homework']);
});

test('Recht „HÜs lösen“: Standard selbst, alte Schalter zählen weiter', () => {
  assert.equal(levelFor(getUser(school)!, 'homework'), 'auto');
  updateUserSettings(school, { homeworkAutopilot: false });
  assert.equal(levelFor(getUser(school)!, 'homework'), 'never');
  updateUserSettings(school, { homeworkAutopilot: true, permissions: { homework: 'ask' } });
  assert.equal(levelFor(getUser(school)!, 'homework'), 'ask');
  updateUserSettings(school, { permissions: {} });
});

test('Schnellaktionen: Schule sieht Foto und Hausübung (an der alten Stelle), der Job nicht', () => {
  const ids = (id: string) => quickActions(getUser(id)!, 14).actions.map((a) => a.id);
  const s = ids(school);
  assert.ok(s.includes('photo') && s.includes('homework') && s.includes('voice') && s.includes('week') && s.includes('mail'));
  assert.deepEqual(quickActions(getUser(school)!, 9).actions.slice(0, 3).map((a) => a.id), ['briefing', 'photo', 'homework']);
  assert.ok(!ids(job).includes('photo') && !ids(job).includes('homework'));
});

test('System-Prompt: Schulwörter je Land und das Hausaufgaben-Werkzeug nur für Schüler:innen', () => {
  const sp = systemPrompt(getUser(school)!, todayIn('Europe/Vienna')).fixed;
  assert.match(sp, /homework = "Hausübung"/);
  assert.match(sp, /solve_homework/);
  const jp = systemPrompt(getUser(job)!, todayIn('Europe/Vienna')).fixed;
  assert.ok(!/solve_homework/.test(jp) && !/School words/.test(jp));
});

test('Was Stella vorhat: HÜ-Autopilot nur für Schüler:innen', () => {
  assert.deepEqual(pluginAutomations(getUser(school)!).map((a) => a.key), ['perm:homework']);
  assert.deepEqual(pluginAutomations(getUser(job)!), []);
});

test('Kurznotizen: mit dem Plugin ist „Französisch HÜ S. 45“ eine Hausübung, ohne nicht', () => {
  const text = 'Französisch HÜ S. 45 Nr. 16 Freitag';
  const withPlugin = interpret(text, '2026-10-28', '12:00', { extra: pluginParser() }) as { type: string; entry: { kind: string; subject: string; page: string } };
  assert.equal(withPlugin.type, 'create');
  assert.deepEqual([withPlugin.entry.kind, withPlugin.entry.subject, withPlugin.entry.page], ['homework', 'Französisch', '45']);
  const without = interpret(text, '2026-10-28', '12:00') as { entry?: { kind: string } } | null;
  assert.notEqual(without?.entry?.kind, 'homework');
});

test('Texte: Schulwörter für Students-Konten, neutrale Fassung für das normale Stella, Begrüßung mit Schul-Beispielen', async () => {
  const { tr, welcomeText } = await import('../../core/server/src/locale.ts');
  const de = { settings: { locale: 'de' as const } };
  assert.equal(tr({ ...de, edition: 'students' }, 'today.noTests'), 'Keine Tests');
  assert.equal(tr({ ...de, edition: 'life' }, 'today.noTests'), 'Keine Prüfungen');
  assert.match(tr({ ...de, edition: 'students' }, 'today.noTestsHint'), /Mathe SA/);
  assert.doesNotMatch(tr({ ...de, edition: 'life' }, 'today.noTestsHint'), /SA/);
  assert.match(welcomeText({ ...de, edition: 'students', name: 'Mia' }), /Latein HÜ S\. 45 Nr\. 3 Freitag/);
  assert.doesNotMatch(welcomeText({ ...de, edition: 'life', name: 'Mia' }), /Latein|HÜ|Schularbeit/);
  for (const locale of ['en', 'es', 'fr', 'it', 'pt-BR', 'tr', 'pl'] as const) {
    assert.notEqual(tr({ settings: { locale }, edition: 'students' }, 'students.welcome.examples'), 'students.welcome.examples', locale);
  }
});
