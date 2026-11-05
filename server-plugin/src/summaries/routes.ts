import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getUser, HttpError } from '../runtime.ts';
import { cancelSummary, deleteSummary, getSummary, listSummaries, startSummary, summaryToCards, summaryToExam, summaryToNotebook } from './summaries.ts';

const body = (req: FastifyRequest) => ((req.body ?? {}) as Record<string, unknown>);
type Params = { Params: { id: string } };

export function registerSummaryRoutes(api: FastifyInstance) {
  api.get('/api/students/summaries', async (req) => ({ summaries: listSummaries(req.user.id) }));
  api.get<Params>('/api/students/summaries/:id', async (req) => {
    const s = getSummary(req.user.id, req.params.id);
    if (!s) throw new HttpError(404, 'Nicht gefunden');
    return { summary: s };
  });
  api.post('/api/students/summaries', async (req) => {
    const b = body(req);
    const images = Array.isArray(b.images) ? b.images.filter((x): x is string => typeof x === 'string') : [];
    return startSummary(getUser(req.user.id)!, { images, subject: typeof b.subject === 'string' ? b.subject : null, day: typeof b.day === 'string' ? b.day : null, title: typeof b.title === 'string' ? b.title : undefined });
  });
  api.post<Params>('/api/students/summaries/:id/cancel', async (req) => { if (!cancelSummary(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });
  api.delete<Params>('/api/students/summaries/:id', async (req) => { if (!deleteSummary(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });
  api.post<Params>('/api/students/summaries/:id/cards', async (req) => summaryToCards(getUser(req.user.id)!, req.params.id, Number(body(req).count) || undefined));
  api.post<Params>('/api/students/summaries/:id/exam', async (req) => ({ result: summaryToExam(getUser(req.user.id)!, req.params.id, String(body(req).examId ?? '')) }));
  api.post<Params>('/api/students/summaries/:id/notebook', async (req) => { if (!summaryToNotebook(req.user.id, req.params.id)) throw new HttpError(404, 'Nicht gefunden'); return { ok: true }; });
}
