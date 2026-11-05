import { useCallback, useEffect, useRef, useState } from 'react';
import { api, useStore } from '@stella/web-core/store.ts';
import { useT } from '@stella/web-core/i18n.ts';
import { showToast } from '@stella/web-core/ui/Decor.tsx';

interface Summary { id: string; title: string; subject: string | null; day: string | null; text: string; openQuestions: string[]; status: 'working' | 'done' | 'failed'; progress: string | null; error: string | null }

/** Foto auf höchstens 2000 px verkleinern und als JPEG kodieren (Handyfotos sind sonst viel zu groß für die Anfrage) */
async function readAsDataUrl(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

/** Mitschriften aus Fotos: hochladen, Fortschritt sehen, abbrechen, lesen, weiterverwenden (Karten, Prüfungsstoff, Heft). */
export function Notes() {
  const t = useT();
  const items = useStore((s) => s.items);
  const [list, setList] = useState<Summary[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const exams = Object.values(items).filter((i) => i.kind === 'exam' && i.status === 'open' && !i.deleted);

  const load = useCallback(() => { void api<{ summaries: Summary[] }>('/api/students/summaries').then((r) => setList(r.summaries)).catch(() => {}); }, []);
  useEffect(load, [load]);
  // solange etwas verarbeitet wird, alle paar Sekunden nachsehen
  const working = list.some((s) => s.status === 'working');
  useEffect(() => { if (!working) return; const h = setInterval(load, 2500); return () => clearInterval(h); }, [working, load]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true);
    try {
      const images = await Promise.all(files.slice(0, 8).map(readAsDataUrl));
      await api('/api/students/summaries', { method: 'POST', json: { images, subject: subject || null } });
      setFiles([]); setSubject(''); if (input.current) input.current.value = '';
      load();
    } catch (err) { showToast((err as Error).message, true); } finally { setBusy(false); }
  }
  const act = async (path: string, json: unknown, ok?: (r: any) => string) => {
    try { const r = await api<any>(path, { method: 'POST', json }); if (ok) showToast(ok(r)); load(); } catch (err) { showToast((err as Error).message, true); }
  };

  return (
    <>
      <details>
        <summary>{t('notes.add')}</summary>
        <form className="form-grid" onSubmit={start} style={{ marginTop: 10 }}>
          <label>{t('notes.photos')}<input ref={input} type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label>
          <label>{t('notes.subject')}<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={60} /></label>
          <button type="submit" className="btn" disabled={busy || !files.length}>{t('notes.make')}</button>
        </form>
      </details>
      {list.length === 0 && <p className="muted">{t('notes.none')}</p>}
      {list.map((s) => (
        <article key={s.id} className="note-summary">
          <h3>{s.title}{s.subject && <span className="small muted"> · {s.subject}</span>}</h3>
          {s.status === 'working' && (
            <div className="learn-row"><span className="muted">{t('notes.working', { progress: s.progress ?? '' })}</span>
              <button type="button" className="btn secondary" onClick={() => void act(`/api/students/summaries/${s.id}/cancel`, {})}>{t('notes.cancel')}</button></div>
          )}
          {s.status === 'failed' && <p className="muted">{t('notes.failed', { error: s.error ?? '' })}</p>}
          {s.status === 'done' && (
            <>
              <p className="note-text">{s.text}</p>
              {s.openQuestions.length > 0 && <><strong className="small">{t('notes.open')}</strong><ul>{s.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul></>}
              <div className="button-row">
                <button type="button" className="btn secondary" onClick={() => void act(`/api/students/summaries/${s.id}/cards`, {}, (r) => t('cards.added', { count: r.added.length }))}>{t('notes.toCards')}</button>
                <button type="button" className="btn secondary" onClick={() => void act(`/api/students/summaries/${s.id}/notebook`, {}, () => t('notes.queued'))}>{t('notes.toNotebook')}</button>
                {exams.length > 0 && (
                  <select aria-label={t('notes.examPick')} value="" onChange={(e) => { if (e.target.value) void act(`/api/students/summaries/${s.id}/exam`, { examId: e.target.value }); }}>
                    <option value="">{t('notes.toExam')} …</option>
                    {exams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </select>
                )}
                <button type="button" className="btn secondary" onClick={() => { void api(`/api/students/summaries/${s.id}`, { method: 'DELETE' }).then(load).catch(() => {}); }}>{t('notes.delete')}</button>
              </div>
            </>
          )}
          {s.status === 'failed' && <button type="button" className="btn secondary" onClick={() => { void api(`/api/students/summaries/${s.id}`, { method: 'DELETE' }).then(load).catch(() => {}); }}>{t('notes.delete')}</button>}
        </article>
      ))}
    </>
  );
}
