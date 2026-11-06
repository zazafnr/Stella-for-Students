import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-onb-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.STELLA_ALLOW_REGISTRATION = 'true';

const { config } = await import('../../core/server/src/config.ts');
const { register } = await import('../../core/server/src/auth.ts');
const { getUser, updateUserSettings } = await import('../../core/server/src/db.ts');
const { setKey } = await import('../../core/server/src/keys.ts');
const { setMailTransportFactory } = await import('../../core/server/src/mailer.ts');
const { freenotesWaitlist, announceFreenotes } = await import('./notes.ts');
const { shouldAskLocation, recordLocationAnswer, locationAskText } = await import('../../core/server/src/location.ts');

const sent: { to: string; subject: string; html?: string }[] = [];
setMailTransportFactory(() => ({ sendMail: async (m: { to: string; subject: string; html?: string }) => { sent.push(m); return {} as never; } }));
setKey('smtp', { host: 'smtp.example.com', port: 465, user: 'noreply@evolsior.com', pass: 'x', from: 'Stella <noreply@evolsior.com>' });
after(() => { /* nichts offen */ });

const mk = (name: string, locale: 'de' | 'es' | 'en', notify: boolean) => {
  const { user } = register(name, `${name.toLowerCase()}@example.com`, 'supergeheim', 'Europe/Vienna');
  updateUserSettings(user.id, { locale, ...(notify ? { notify: { freenotes: true } } : {}) });
  return user.id;
};
const { loadEditions } = await import('../../core/server/src/editions/load.ts');
await loadEditions(path.resolve(import.meta.dirname, '..'));

test('„Benachrichtige mich“: Warteliste, Mail in der Sprache der Person, jede Person genau einmal', async () => {
  const mia = mk('Mia', 'de', true);
  mk('Nico', 'en', false);
  const eva = mk('Eva', 'es', true);
  assert.deepEqual(freenotesWaitlist().sort(), [mia, eva].sort());

  config.freenotesUrl = '';
  await assert.rejects(announceFreenotes(), /STELLA_FREENOTES_URL/);

  config.freenotesUrl = 'https://freenotes.example.com/get';
  const r = await announceFreenotes();
  assert.deepEqual(r, { notified: 2, failed: 0 });
  assert.equal(sent.length, 2);
  assert.ok(sent.find((m) => m.to === 'mia@example.com')!.subject.includes('FreeNotes ist da'));
  assert.ok(sent.find((m) => m.to === 'eva@example.com')!.subject.includes('ya está aquí'));
  assert.ok(sent[0]!.html!.includes('https://freenotes.example.com/get'));
  assert.deepEqual(freenotesWaitlist(), []);
  assert.deepEqual(await announceFreenotes(), { notified: 0, failed: 0 });
});

