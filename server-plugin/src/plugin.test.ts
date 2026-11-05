import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Der Kern-Spiegel ist hier der Gastgeber: Daten in einen Wegwerf-Ordner, dann das Plugin über den echten Lader einhängen.
process.env.STELLA_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'stella-students-'));
process.env.STELLA_SECRET = 'test-secret-1234567890';
process.env.OPENROUTER_API_KEY = '';

const { loadEditions } = await import('../../core/server/src/editions/load.ts');
const { editions, resetEditions } = await import('../../core/server/src/editions/registry.ts');

test('das Plugin lässt sich vom Server-Lader einhängen und liefert eine gültige Antwort', async () => {
  resetEditions();
  const res = await loadEditions(path.resolve(import.meta.dirname, '..'));
  // Paket 2: das Plugin ist noch ein Platzhalter (null) → der Server fällt auf sein eingebautes Plugin zurück
  assert.equal(res.loaded.length, 1);
  assert.equal(editions().length, 1);
});
