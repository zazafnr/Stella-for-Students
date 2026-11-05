import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// Simuliertes OpenRouter: ein überlastetes Modell, ein funktionierendes, das ein Werkzeug aufruft.
const calls: { model: string; messages: { role: string; content: string }[] }[] = [];
const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/models') {
      res.end(JSON.stringify({
        data: [
          { id: 'busy/model:free', context_length: 1e6, supported_parameters: ['tools'] },
          { id: 'good/model:free', context_length: 1e5, supported_parameters: ['tools'] },
          { id: 'notools/model:free', context_length: 1e6, supported_parameters: [] },
          { id: 'paid/model', context_length: 1e6, supported_parameters: ['tools'], pricing: { prompt: '0.001', completion: '0.002' } },
          { id: 'eyes/model:free', context_length: 1e5, supported_parameters: [], architecture: { input_modalities: ['text', 'image'] } },
        ],
      }));
      return;
    }
    const json = JSON.parse(body);
    calls.push(json);
    const hasImage = json.messages.some((m: { content: unknown }) => Array.isArray(m.content) && m.content.some((p: { type: string }) => p.type === 'image_url'));
    if (hasImage) {
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify({
        found: true, heftText: '__S. 45 Nr. 16__\n\n1) Oui, elle y va en avion.\n2) Non, je ne m\'y intéresse pas.',
      }) } }] }));
      return;
    }
    if (json.model === 'busy/model:free') { res.statusCode = 429; res.end('{"error":"rate limited"}'); return; }
    const hasToolResult = json.messages.some((m: { role: string }) => m.role === 'tool');
    // nächtliche Lern-Runde
    if (String(json.messages[0]?.content).includes('sich Dauerhaftes über seinen Nutzer')) {
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify({ facts: [
        { category: 'person', text: 'Mia ist die beste Freundin' },
        { category: 'quatsch', text: 'wird ignoriert' },
      ] }) } }] }));
      return;
    }
    // Gedächtnis: Nutzer erzählt von einer Routine → KI merkt sie sich selbst
    const lastUser = [...json.messages].reverse().find((m: { role: string }) => m.role === 'user');
    if (String(lastUser?.content).includes('Training')) {
      res.end(JSON.stringify({ choices: [{ message: hasToolResult
        ? { role: 'assistant', content: 'Viel Spaß beim Training! ⚽' }
        : { role: 'assistant', content: null, tool_calls: [{ id: 'm1', type: 'function', function: { name: 'remember', arguments: JSON.stringify({
          text: 'Fußballtraining', category: 'routine', schedule: { days: [2, 4], start: '17:00', end: '18:30' },
        }) } }] } }] }));
      return;
    }
    res.end(JSON.stringify({
      choices: [{
        message: hasToolResult
          ? { role: 'assistant', content: 'Erledigt! Zahnarzt ist eingetragen 🦷' }
          : {
            role: 'assistant', content: null,
            tool_calls: [{ id: 't1', type: 'function', function: { name: 'create_entry', arguments: JSON.stringify({ kind: 'event', title: 'Zahnarzt', due: '2026-11-20', time: '14:30' }) } }],
          },
      }],
    }));
  });
});
await new Promise<void>((r) => mock.listen(0, r));

process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-agent-'));
process.env.OPENROUTER_API_KEY = 'test';
process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
process.env.STELLA_SECRET = 'test-secret-1234567890';

const { register } = await import('../../core/server/src/auth.ts');
const { listItems } = await import('../../core/server/src/db.ts');
const { handleChat } = await import('../../core/server/src/assistant.ts');
const { modelChain } = await import('../../core/server/src/llm.ts');
const { solveHomework } = await import('./homework.ts');
const { db, getItem } = await import('../../core/server/src/db.ts');
const { saveFile } = await import('../../core/server/src/files.ts');
const { loadEditions } = await import('../../core/server/src/editions/load.ts');
await loadEditions(path.resolve(import.meta.dirname, '..'));
const { user } = register('Lukas', 'l@example.com', 'supergeheim', 'Europe/Vienna');

after(async () => {
  mock.close();
  const { getBrowser } = await import('./browser.ts');
  await (await getBrowser()).close().catch(() => {});
});

test('HÜ-Autopilot: Foto → gelöst, in Handschrift, erledigt, Vorabend-Info statt Erinnerung', async () => {
  // 1×1-PNG als "Foto der Aufgabe"
  const photo = saveFile(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'), 'png');
  const res = await handleChat(user, 'Französisch HÜ S. 45 Nr. 16 in 3 tagen', 'p1', [photo]);
  const item = res.items.find((i) => i.kind === 'homework')!;
  assert.equal(item.attachments.length, 1);
  assert.match(res.messages[0].text, /schreib sie dir ins Heft/);
  assert.ok(db.prepare(`SELECT 1 FROM jobs WHERE type = 'solve_homework' AND payload LIKE ?`).get(`%${item.id}%`));

  await solveHomework(user.id, item.id);
  const solved = getItem(user.id, item.id)!;
  assert.equal(solved.status, 'done');
  assert.match(solved.notes!, /elle y va en avion/);
  assert.equal(solved.attachments.length, 2);
  const reminders = db.prepare('SELECT message, always FROM reminders WHERE item_id = ? AND sent_at IS NULL').all(item.id) as { message: string; always: number }[];
  assert.deepEqual(reminders.map((r) => r.always), [1]);
  assert.match(reminders[0].message, /erledigt/);

  // FreeNotes holt die Lösung ab und bestätigt sie
  const { notesInbox, ackNotesEntry } = await import('./notes.ts');
  const inbox = notesInbox(user.id);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].subject, 'Französisch');
  assert.match(inbox[0].text, /^__S\. 45 Nr\. 16__/);
  assert.ok(ackNotesEntry(user.id, item.id, 'Französisch-Heft', 3));
  assert.equal(notesInbox(user.id).length, 0);
});

