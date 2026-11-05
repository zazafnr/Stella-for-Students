// Erzeugt die Zusatz-Texte der Studenten-iOS-App als Swift-Quelltext:
//   server-plugin/i18n/<sprache>.json  (neue Schlüssel)  +  server-plugin/i18n/overrides/<sprache>.json  (Überschreibungen des Kerns)
// → ios/StellaStudents.swiftpm/App/StudentsCatalogs.swift, die die App beim Start in `I18n.extraJSON` einträgt.
//   npx tsx scripts/gen-ios-catalogs.ts          schreiben
//   npx tsx scripts/gen-ios-catalogs.ts --check  nur prüfen (CI)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'server-plugin/i18n');
const target = path.join(root, 'ios/StellaStudents.swiftpm/App/StudentsCatalogs.swift');
const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pl', 'pt-BR', 'tr'];

const read = (f: string): Record<string, string> => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {});
const entries = LOCALES.map((l) => {
  // Texte, die nur der Server braucht (Mails, Abo-Hinweise), bleiben draußen
  const merged = { ...read(path.join(dir, `${l}.json`)), ...read(path.join(dir, 'overrides', `${l}.json`)) };
  const keep = Object.fromEntries(Object.entries(merged).filter(([k]) => !k.startsWith('students.') && !k.startsWith('email.')).sort(([a], [b]) => a.localeCompare(b)));
  const json = JSON.stringify(keep, null, 1);
  if (json.includes('"""#')) throw new Error(`${l}: enthält die Zeichenfolge "\"\"#"`);
  return `        "${l}": #"""\n${json}\n"""#,`;
});

const out = `// AUTOMATISCH ERZEUGT von scripts/gen-ios-catalogs.ts – nicht von Hand ändern.
// Quelle: server-plugin/i18n/*.json und server-plugin/i18n/overrides/*.json

enum StudentsCatalogs {
    static let json: [String: String] = [
${entries.join('\n')}
    ]
}
`;

if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== out) { console.error('StudentsCatalogs.swift ist nicht aktuell. Bitte `npx tsx scripts/gen-ios-catalogs.ts` ausführen.'); process.exit(1); }
  console.log('Studenten-iOS-Kataloge sind aktuell.');
} else {
  writeFileSync(target, out);
  console.log(`geschrieben: ${path.relative(root, target)}`);
}
