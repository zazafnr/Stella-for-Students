// Kern-Spiegel erzeugen und prüfen.
//
//   npm run sync:core                  # core/ aus ../Stella-Life-Assistent neu schreiben (und core/CORE_COMMIT)
//   npm run sync:core -- --check       # nur vergleichen; Exit 1, wenn jemand im Spiegel gearbeitet hat
//   STELLA_CORE_PATH=/pfad/zum/kern    # anderer Klon von Stella-Life-Assistent
//   --allow-dirty                      # auch einen Kern mit uncommitteten Änderungen spiegeln (nur lokal; CI schlägt dann fehl)
//
// Regel: core/ wird nie von Hand geändert. Jede Änderung am Kern passiert in Stella-Life-Assistent.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const ALLOW_DIRTY = args.includes('--allow-dirty');
const SRC = path.resolve(process.env.STELLA_CORE_PATH ?? path.join(ROOT, '../Stella-Life-Assistent'));
const DEST = path.join(ROOT, 'core');

/** Was gespiegelt wird: Pfad im Kern → Pfad unter core/. Fehlt etwas im Kern (z. B. web-core vor Paket 4), wird es übersprungen. */
const MAPPINGS: [string, string][] = [
  ['tsconfig.base.json', 'tsconfig.base.json'],
  ['shared', 'shared'],
  ['server', 'server'],
  ['web-core', 'web-core'],
  ['ios/Stella.swiftpm/Core', 'ios/Stella.swiftpm/Core'],
  ['ios/Stella.swiftpm/Design', 'ios/Stella.swiftpm/Design'],
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'data', '.turbo', '.vite']);
const SKIP_FILES = new Set(['.DS_Store', '.env']);
const NOTE = 'Kern-Spiegel – nicht hier ändern, Änderungen in Stella-Life-Assistent';

/** Kommentarkopf je Dateityp; Dateien ohne Kommentarsyntax (JSON …) bleiben unverändert */
function header(file: string): string | null {
  const ext = path.extname(file);
  if (['.ts', '.tsx', '.js', '.mjs', '.swift'].includes(ext)) return `// ${NOTE}\n`;
  if (ext === '.css') return `/* ${NOTE} */\n`;
  return null;
}

function mirrored(file: string, content: Buffer): Buffer {
  const h = header(file);
  if (!h) return content;
  const text = content.toString('utf8');
  // Shebang bleibt in Zeile 1
  if (text.startsWith('#!')) {
    const nl = text.indexOf('\n') + 1;
    return Buffer.from(text.slice(0, nl) + h + text.slice(nl));
  }
  return Buffer.from(h + text);
}

function walk(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_FILES.has(name)) continue;
    const full = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) out.push(...walk(full, r)); } else out.push(r);
  }
  return out;
}

/** Soll-Zustand von core/: Pfad (relativ zu core/) → Inhalt */
function expected(): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const [from, to] of MAPPINGS) {
    const abs = path.join(SRC, from);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isFile()) { files.set(to, mirrored(to, readFileSync(abs))); continue; }
    for (const rel of walk(abs)) files.set(`${to}/${rel}`, mirrored(rel, readFileSync(path.join(abs, rel))));
  }
  return files;
}

function git(...a: string[]): string {
  return execFileSync('git', ['-C', SRC, ...a], { encoding: 'utf8' }).trim();
}

function coreCommit(): string {
  const head = git('rev-parse', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  if (dirty && !ALLOW_DIRTY) {
    console.error(`Der Kern in ${SRC} hat uncommittete Änderungen. Erst committen (und pushen) oder mit --allow-dirty spiegeln.`);
    process.exit(2);
  }
  return dirty ? `${head}-dirty` : head;
}

function actual(): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  if (!existsSync(DEST)) return files;
  for (const rel of walk(DEST)) if (rel !== 'CORE_COMMIT') files.set(rel, readFileSync(path.join(DEST, rel)));
  return files;
}

if (!existsSync(SRC)) { console.error(`Kern nicht gefunden: ${SRC} (STELLA_CORE_PATH setzen).`); process.exit(2); }
const want = expected();

if (CHECK) {
  const have = actual();
  const problems: string[] = [];
  for (const [f, c] of want) {
    if (!have.has(f)) problems.push(`fehlt im Spiegel: ${f}`);
    else if (!have.get(f)!.equals(c)) problems.push(`geändert: ${f}`);
  }
  for (const f of have.keys()) if (!want.has(f)) problems.push(`gehört nicht in den Spiegel: ${f}`);
  const recorded = existsSync(path.join(DEST, 'CORE_COMMIT')) ? readFileSync(path.join(DEST, 'CORE_COMMIT'), 'utf8').trim() : '';
  const head = git('rev-parse', 'HEAD');
  if (recorded && !recorded.startsWith(head) && !problems.length) console.warn(`Hinweis: core/CORE_COMMIT (${recorded.slice(0, 8)}) ist nicht der Stand des Kerns (${head.slice(0, 8)}), die Dateien stimmen aber überein.`);
  if (problems.length) {
    console.error(`Der Kern-Spiegel weicht ab (${problems.length}):\n${problems.slice(0, 30).map((p) => `  ${p}`).join('\n')}${problems.length > 30 ? '\n  …' : ''}`);
    console.error('Im Spiegel nie von Hand arbeiten: Änderung in Stella-Life-Assistent machen, dort committen, dann `npm run sync:core`.');
    process.exit(1);
  }
  console.log(`Kern-Spiegel stimmt (${want.size} Dateien, Kern ${recorded.slice(0, 8) || '?'}).`);
} else {
  const commit = coreCommit();
  rmSync(DEST, { recursive: true, force: true });
  for (const [f, c] of want) {
    const target = path.join(DEST, f);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, c);
  }
  writeFileSync(path.join(DEST, 'CORE_COMMIT'), `${commit}\n`);
  console.log(`Kern-Spiegel geschrieben: ${want.size} Dateien, Kern ${commit.slice(0, 8)}.`);
}
