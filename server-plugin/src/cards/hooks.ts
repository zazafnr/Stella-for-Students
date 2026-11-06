import { timeIn, todayIn } from '@stella/shared';
import { db, getUser, levelFor, notify, notifyOnce, tr, type EditionPlugin, type Lagebild, type User } from '../runtime.ts';
import { answerCard, dueCards, dueCount } from './cards.ts';

/** Werkzeuge für den Chat: abfragen („Frag mich Französisch ab“) und Antworten bewerten */
export const CARD_TOOLS: NonNullable<EditionPlugin['tools']> = [
  {
    def: {
      type: 'function',
      function: {
        name: 'due_cards',
        description: 'Heute fällige Lernkarten (zum Abfragen). Optional nur ein Fach. Gibt id, front, back zurück – frag immer nur die Vorderseite und zeig die Rückseite erst nach der Antwort.',
        parameters: { type: 'object', properties: { subject: { type: 'string', description: 'Fach oder Stapel, z. B. Französisch' }, limit: { type: 'number', description: 'höchstens so viele (Standard 10)' } } },
      },
    },
    run: (ctx, args) => {
      const cards = dueCards(ctx.user, { subject: args.subject ? String(args.subject) : null, limit: Math.min(Math.max(Number(args.limit) || 10, 1), 30) });
      return { total: dueCount(ctx.user), cards: cards.map((c) => ({ id: c.id, front: c.front, back: c.back, deck: c.deckTitle })), note: cards.length ? undefined : 'Heute ist nichts fällig – sag das freundlich.' };
    },
  },
  {
    def: {
      type: 'function',
      function: {
        name: 'answer_card',
        description: 'Die Antwort des Nutzers auf eine Lernkarte bewerten: correct=true (sinngemäß richtig) oder false. Das stellt den Wiederholungsrhythmus der Karte neu.',
        parameters: { type: 'object', properties: { card_id: { type: 'string' }, correct: { type: 'boolean' } }, required: ['card_id', 'correct'] },
      },
    },
    run: (ctx, args) => {
      try { const c = answerCard(ctx.user, String(args.card_id), args.correct === true); return { ok: true, nextDue: c.due, stage: c.stage }; }
      catch (err) { return { error: (err as Error).message }; }
    },
  },
];

/** Eine Zeile im Briefing (keine Karte): „23 Lernkarten fällig“ */
export function cardBriefing(user: User, lb: Lagebild) {
  const n = dueCount(user, lb.today);
  return n > 0 ? [{ id: 'cards', title: tr(user, 'students.briefing.cards.title'), lines: [tr(user, 'students.briefing.cards', { count: n })] }] : [];
}

const MIN_DUE_FOR_NUDGE = 5;

/**
 * Anstoß in der Lernzeit: läuft eine Lerneinheit (Eintrag `study`) heute gerade oder hat sie in den letzten 10 Minuten begonnen und sind Karten fällig,
 * kommt einmal je Einheit eine kurze Nachricht über den gewählten Kanal. Nur, wenn das Recht „Lernanstöße“ nicht auf „nie“ steht.
 */
export async function cardNudges(userId: string): Promise<void> {
  const user = getUser(userId);
  if (!user || levelFor(user, 'learning') === 'never') return;
  const today = todayIn(user.timeZone);
  const nowHhmm = timeIn(user.timeZone);
  const n = dueCount(user, today);
  if (n < MIN_DUE_FOR_NUDGE) return;
  const sessions = db.prepare(`SELECT id, subject, time, detail FROM items WHERE user_id = ? AND deleted = 0 AND kind = 'study' AND status = 'open' AND due = ? AND time IS NOT NULL`).all(userId, today) as { id: string; subject: string | null; time: string; detail: string | null }[];
  const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  for (const s of sessions) {
    const late = minutes(nowHhmm) - minutes(s.time);
    if (late < 0 || late > 10) continue;
    if (!notifyOnce(userId, `card-nudge:${s.id}`)) continue;
    const text = tr(user, 'students.cards.nudge', { count: n, subject: s.subject ?? '' });
    await notify(userId, { title: 'Stella', body: text, text, tag: `card-nudge-${s.id}` });
  }
}
