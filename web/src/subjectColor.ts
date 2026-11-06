// Jedes Fach hat eine eigene Farbe (wie in FreeNotes). Gleicher Name → gleiche Farbe; unbekannte Fächer bekommen eine aus dem Namen.
const PALETTE = ['#6D4AFF', '#E8548C', '#14A38B', '#F08A24', '#2F80ED', '#9B51E0', '#D64545', '#3BA55D', '#C27C0E', '#0E9AA7'];
const FIXED: Record<string, string> = {
  Mathe: '#2F80ED', Deutsch: '#E8548C', Englisch: '#D64545', Latein: '#C27C0E', Französisch: '#9B51E0', Spanisch: '#F08A24', Italienisch: '#3BA55D',
  Physik: '#0E9AA7', Chemie: '#14A38B', Biologie: '#3BA55D', Geschichte: '#C27C0E', Geografie: '#0E9AA7', Informatik: '#6D4AFF', Musik: '#E8548C', Kunst: '#F08A24',
  Sport: '#D64545', Religion: '#9B51E0', Ethik: '#9B51E0',
};
export function subjectColor(subject: string | null | undefined): string {
  if (!subject) return '#6D4AFF';
  if (FIXED[subject]) return FIXED[subject]!;
  let h = 0;
  for (const c of subject) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
