import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-test-'));
process.env.OPENROUTER_API_KEY = '';
process.env.STELLA_SECRET = 'test-secret-1234567890';

const { register, setSecret, getSecret } = await import('../../core/server/src/auth.ts');
const { db, getUser, listItems, updateUserSettings } = await import('../../core/server/src/db.ts');
const { handleChat } = await import('../../core/server/src/assistant.ts');
const { addDays, todayIn } = await import('@stella/shared');

const { user } = register('Lukas', 'lukas@example.com', 'supergeheim', 'Europe/Vienna');
const today = todayIn('Europe/Vienna');
const { loadEditions } = await import('../../core/server/src/editions/load.ts');
await loadEditions(path.resolve(import.meta.dirname, '..'));

test('HÜ per Kurznotiz → Eintrag, Erinnerung am Vorabend, Buchseiten-Job', async () => {
  updateUserSettings(user.id, { books: [{ subject: 'Latein', provider: 'digi4school', url: 'https://digi4school.at/ebook/abc' }] });
  const u = getUser(user.id)!;
  const res = await handleChat(u, 'Latein Hü Seite 45 nr 3 in 5 tagen', 'c1');
  assert.equal(res.items.length, 1);
  const item = res.items[0];
  assert.equal(item.title, 'Latein HÜ');
  assert.equal(item.due, addDays(today, 5));
  assert.match(res.messages[0].text, /Notiert.*Latein HÜ.*S\. 45 Nr\. 3/);
  assert.match(res.messages[0].text, /digi4school, lös die Aufgabe und schreib sie dir ins Heft/);

  const reminders = db.prepare('SELECT * FROM reminders WHERE item_id = ?').all(item.id) as { fire_at: string; with_attachments: number }[];
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].with_attachments, 1);
  const jobs = db.prepare(`SELECT * FROM jobs WHERE type = 'book_page'`).all();
  assert.equal(jobs.length, 1);
});

