import type { PluginMigration } from '../runtime.ts';

/** Tabellen der Uni-Funktionen (eigener Zähler `edition_migrations`, getrennt von `PRAGMA user_version` des Kerns) */
export const UNI_MIGRATIONS: PluginMigration[] = [
  {
    id: 'uni-001',
    sql: `
    CREATE TABLE IF NOT EXISTS terms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS terms_user ON terms(user_id);
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      term_id TEXT REFERENCES terms(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      code TEXT,
      lecturer TEXT,
      ects REAL,
      color TEXT,
      location TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS courses_user ON courses(user_id);
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      title TEXT,
      grade REAL NOT NULL,
      weight REAL,
      date TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS grades_user ON grades(user_id);
    CREATE TABLE IF NOT EXISTS timetable_feeds (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_run TEXT,
      last_ok TEXT,
      last_error TEXT,
      lessons INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ics_lessons (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      uid TEXT NOT NULL,
      date TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      subject TEXT,
      course_id TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'normal',
      info TEXT,
      seen_at TEXT NOT NULL,
      PRIMARY KEY (user_id, uid, date, start)
    );
    CREATE INDEX IF NOT EXISTS ics_lessons_user_date ON ics_lessons(user_id, date);
    `,
  },
];
