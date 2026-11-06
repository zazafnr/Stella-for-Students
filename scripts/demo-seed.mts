// Beispieldaten für die Klick-Vorschau der Studenten-iOS-App (CI) und für Website-Bilder.
// Nimmt die Schüler-Beispieldaten des Kerns (Stundenplan, Tests, HÜs, Mails, Chat) und macht daraus ein Studenten-Konto:
// Edition „students“, dazu Lernkarten und eine Mitschrift. Gibt wie das Kern-Skript nur den Login-Token aus (stdout).
//
//   STELLA_DATA_DIR=/tmp/demo STELLA_SECRET=… npx tsx scripts/demo-seed.ts > token.txt
//   DEMO_LANG=en für englische Beispieldaten

import path from 'node:path';

await import('../core/server/scripts/demo-seed.ts');

const { db, getUser } = await import('../core/server/src/db.ts');
const { loadEditions } = await import('../core/server/src/editions/load.ts');
const EN = process.env.DEMO_LANG === 'en';
const t = (de: string, en: string) => (EN ? en : de);

db.prepare("UPDATE users SET edition = 'students'").run();
await loadEditions(path.resolve(import.meta.dirname, '../server-plugin')); // legt auch die Tabellen des Plugins an
const user = getUser((db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string }).id)!;
const cards = await import('../server-plugin/src/cards/cards.ts');

const deck = cards.createDeck(user.id, t('Französisch Vokabeln', 'Spanish vocabulary'), t('Französisch', 'Spanish'), 'manual');
cards.addCards(user, deck, EN
  ? [['la casa', 'the house'], ['el gato', 'the cat'], ['la escuela', 'the school'], ['el libro', 'the book'], ['la ventana', 'the window'], ['el profesor', 'the teacher']]
      .map(([front, back]) => ({ front: front!, back: back! }))
  : [['la maison', 'das Haus'], ['le chat', 'die Katze'], ['l’école', 'die Schule'], ['le livre', 'das Buch'], ['la fenêtre', 'das Fenster'], ['le professeur', 'der Lehrer']]
      .map(([front, back]) => ({ front: front!, back: back! })));
const bio = cards.createDeck(user.id, t('Biologie: Zelle', 'Biology: the cell'), t('Biologie', 'Biology'), 'manual');
cards.addCards(user, bio, [
  { front: t('Was macht der Zellkern?', 'What does the nucleus do?'), back: t('Er speichert die Erbinformation.', 'It stores the genetic information.') },
  { front: t('Wo läuft die Photosynthese ab?', 'Where does photosynthesis happen?'), back: t('In den Chloroplasten.', 'In the chloroplasts.') },
  { front: t('Wozu dienen Mitochondrien?', 'What are mitochondria for?'), back: t('Sie liefern Energie für die Zelle.', 'They supply the cell with energy.') },
]);

db.prepare(`INSERT INTO notes_summaries (id, user_id, subject, day, title, text, open_questions, sources, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'done', ?)`)
  .run('demo-summary', user.id, t('Biologie', 'Biology'), new Date().toISOString().slice(0, 10), t('Photosynthese', 'Photosynthesis'),
    t('• Ablauf: Lichtreaktion und Calvin-Zyklus\n• Ort: Chloroplasten\n\n★ Photosynthese erzeugt Glukose und Sauerstoff.\n\nChlorophyll: grüner Farbstoff, fängt Licht ein',
      '• Steps: light reaction and Calvin cycle\n• Place: chloroplasts\n\n★ Photosynthesis produces glucose and oxygen.\n\nChlorophyll: green pigment that captures light'),
    JSON.stringify([t('Die Formel auf Seite 2 war unleserlich', 'The formula on page 2 was unreadable')]), new Date().toISOString());
process.stderr.write('Studenten-Beispieldaten angelegt\n');
