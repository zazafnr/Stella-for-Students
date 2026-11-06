import type { PluginMigration } from '../runtime.ts';

export const CARD_MIGRATIONS: PluginMigration[] = [
  {
    id: 'cards-001',
    sql: `
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      subject TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS decks_user ON decks(user_id);
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      due TEXT NOT NULL,
      stage INTEGER NOT NULL DEFAULT 1,
      last_answer TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cards_due ON cards(user_id, due);
    CREATE INDEX IF NOT EXISTS cards_deck ON cards(deck_id);
    `,
  },
];
