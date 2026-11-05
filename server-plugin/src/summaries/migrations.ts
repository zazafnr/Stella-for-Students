import type { PluginMigration } from '../runtime.ts';

export const SUMMARY_MIGRATIONS: PluginMigration[] = [
  {
    id: 'summaries-001',
    sql: `
    CREATE TABLE IF NOT EXISTS notes_summaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT,
      day TEXT,
      title TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      open_questions TEXT NOT NULL DEFAULT '[]',
      sources TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'working',   -- working | done | failed
      progress TEXT,
      error TEXT,
      to_notebook INTEGER NOT NULL DEFAULT 0,
      delivered_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_summaries_user ON notes_summaries(user_id, created_at);
    `,
  },
];
