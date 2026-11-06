import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getUser, HttpError } from '../runtime.ts';
import { addCards, answerCard, createDeck, deleteCard, deleteDeck, deckOf, dueCards, dueCount, examMaterial, generateDeck, listCards, listDecks } from './cards.ts';

const body = (req: FastifyRequest) => ((req.body ?? {}) as Record<string, unknown>);
type Params = { Params: { id: string } };

export function registerCardRoutes(api: FastifyInstance) {
  // Lernen-Tab: „Heute dran“ – die fälligen Karten (nur die Zahl und die Karten, sonst nichts)
  api.get('/api/students/cards/today', async (req) => {
    const user = getUser(req.user.id)!;
    const q = req.query as Record<string, string>;
    return { due: dueCount(user), cards: dueCards(user, { subject: q.subject || null, deckId: q.deck || null, limit: Number(q.limit) || 50 }) };
  });
  api.post<Params>('/api/students/cards/:id/answer', async (req) => ({ card: answerCard(getUser(req.user.id)!, req.params.id, body(req).correct === true) }));
  api.delete<Params>('/api/students/cards/:id', async (req) => { if (!deleteCard(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });

  api.get('/api/students/decks', async (req) => ({ decks: listDecks(getUser(req.user.id)!) }));
  api.get<Params>('/api/students/decks/:id', async (req) => {
    const deck = deckOf(req.user.id, req.params.id);
    if (!deck) throw new HttpError(404, 'Nicht gefunden');
    return { deck, cards: listCards(req.user.id, deck.id) };
  });
  api.delete<Params>('/api/students/decks/:id', async (req) => { if (!deleteDeck(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });

  // Von Hand: Stapel anlegen (optional mit Karten)
  api.post('/api/students/decks', async (req) => {
    const user = getUser(req.user.id)!;
    const b = body(req);
    const id = createDeck(user.id, String(b.title ?? ''), typeof b.subject === 'string' ? b.subject : null, 'manual');
    if (Array.isArray(b.cards)) addCards(user, id, (b.cards as { front: string; back: string }[]).slice(0, 200));
    return { deck: listDecks(user).find((d) => d.id === id) };
  });
  api.post<Params>('/api/students/decks/:id/cards', async (req) => {
    const user = getUser(req.user.id)!;
    const cards = Array.isArray(body(req).cards) ? (body(req).cards as { front: string; back: string }[]) : [{ front: String(body(req).front ?? ''), back: String(body(req).back ?? '') }];
    return { added: addCards(user, req.params.id, cards.slice(0, 200)) };
  });

  // Mit KI: aus eingefügtem Text oder aus dem Stoff einer Prüfung (höchstens 40 Karten je Aufruf)
  api.post('/api/students/decks/generate', async (req) => {
    const user = getUser(req.user.id)!;
    const b = body(req);
    if (typeof b.examId === 'string') {
      const m = examMaterial(user, b.examId);
      return generateDeck(user, { title: typeof b.title === 'string' && b.title ? b.title : m.title, subject: m.subject, text: m.text, count: Number(b.count) || undefined, source: 'exam' });
    }
    return generateDeck(user, { title: String(b.title ?? ''), subject: typeof b.subject === 'string' ? b.subject : null, text: String(b.text ?? ''), count: Number(b.count) || undefined, source: 'text' });
  });
}
