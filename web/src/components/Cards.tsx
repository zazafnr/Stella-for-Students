import { useCallback, useEffect, useState } from 'react';
import { api } from '@stella/web-core/store.ts';
import { useT } from '@stella/web-core/i18n.ts';
import { showToast } from '@stella/web-core/ui/Decor.tsx';

interface Card { id: string; front: string; back: string; deckTitle?: string }
interface Deck { id: string; title: string; cards: number; due: number }

/** Lernkarten: „Heute dran“ – eine Karte nach der anderen, Antwort aufdecken, gewusst / nicht gewusst. Keine Punkte, keine Serien. */
export function Cards() {
  const t = useT();
  const [due, setDue] = useState<{ due: number; cards: Card[] } | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [practice, setPractice] = useState<Card[] | null>(null);
  const [shown, setShown] = useState(false);
  const [form, setForm] = useState({ title: '', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void api<{ due: number; cards: Card[] }>('/api/students/cards/today').then(setDue).catch(() => {});
    void api<{ decks: Deck[] }>('/api/students/decks').then((r) => setDecks(r.decks)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function rate(correct: boolean) {
    const [card, ...rest] = practice!;
    try { await api(`/api/students/cards/${card!.id}/answer`, { method: 'POST', json: { correct } }); } catch (err) { showToast((err as Error).message, true); }
    setShown(false);
    if (rest.length) setPractice(rest); else { setPractice(null); load(); }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ added: unknown[] }>('/api/students/decks/generate', { method: 'POST', json: form });
      showToast(t('cards.added', { count: r.added.length }));
      setForm({ title: '', text: '' });
      load();
    } catch (err) { showToast((err as Error).message, true); } finally { setBusy(false); }
  }

  if (practice) {
    const card = practice[0]!;
    return (
      <div className="card-practice" role="group" aria-label={card.deckTitle ?? ''}>
        <p className="small muted">{practice.length} · {card.deckTitle}</p>
        <div className="card-face"><strong>{card.front}</strong>{shown && <p className="card-back">{card.back}</p>}</div>
        {!shown
          ? <button type="button" className="btn" onClick={() => setShown(true)}>{t('cards.show')}</button>
          : <div className="button-row"><button type="button" className="btn secondary" onClick={() => void rate(false)}>{t('cards.didnt')}</button><button type="button" className="btn" onClick={() => void rate(true)}>{t('cards.knew')}</button></div>}
      </div>
    );
  }

  return (
    <>
      {due && due.due > 0
        ? <div className="learn-row" style={{ justifyContent: 'space-between' }}><strong>{t('cards.today', { count: due.due })}</strong><button type="button" className="btn" onClick={() => { setPractice(due.cards); setShown(false); }}>{t('cards.start')}</button></div>
        : <p className="muted">{t('cards.none')}</p>}
      {decks.length > 0 && (
        <>
          <h3>{t('cards.decks')}</h3>
          {decks.map((d) => <div key={d.id} className="learn-row"><strong style={{ flex: 1 }}>{d.title}</strong><span className="small muted">{t('cards.deckLine', { cards: d.cards, due: d.due })}</span></div>)}
        </>
      )}
      <details style={{ marginTop: 12 }}>
        <summary>{t('cards.new')}</summary>
        <form className="form-grid" onSubmit={generate} style={{ marginTop: 10 }}>
          <label>{t('cards.titleField')}<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={80} /></label>
          <label>{t('cards.textField')}<textarea rows={6} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required minLength={20} /></label>
          <button type="submit" className="btn" disabled={busy}>{busy ? t('cards.generating') : t('cards.generate')}</button>
        </form>
      </details>
    </>
  );
}
