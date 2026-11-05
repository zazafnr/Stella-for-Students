// Wiederholungsrhythmus nach Leitner mit fünf Stufen: 1 Tag → 3 → 7 → 16 → 35. Richtig = eine Stufe höher, falsch = zurück auf Stufe 1.
// Fälligkeiten sind Kalendertage in der Ortszeit der Person („JJJJ-MM-TT“) – so stimmen sie in jeder Zeitzone und über die Sommerzeit hinweg.
// Bewusst ohne Punkte, Serien und Abzeichen: gezeigt wird nur, was heute dran ist.

import { addDays, type Ymd } from '@stella/shared';

export const INTERVALS = [1, 3, 7, 16, 35] as const;
export const MAX_STAGE = INTERVALS.length;

export interface CardState { stage: number; due: Ymd }

/** Neue Karte: Stufe 1, heute dran (sie soll gleich gelernt werden) */
export const newCard = (today: Ymd): CardState => ({ stage: 1, due: today });

/** Zustand nach einer Antwort: heute = Tag der Antwort in der Ortszeit der Person */
export function answer(state: CardState, correct: boolean, today: Ymd): CardState {
  const stage = correct ? Math.min(MAX_STAGE, state.stage + 1) : 1;
  return { stage, due: addDays(today, INTERVALS[stage - 1]!) };
}

export const isDue = (state: CardState, today: Ymd) => state.due <= today;
