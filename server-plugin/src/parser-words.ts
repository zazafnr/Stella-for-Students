// Schulwörter für die Kurznotizen-Erkennung („Latein HÜ S. 45 Nr. 3 Freitag“, „Mathe SA in 10 Tagen“, „Math homework p. 45 friday“).
// Der Kern kennt nur Erwachsenen-Wörter; diese Tabellen schaltet der Server über den Einhängepunkt `parser` zu.

import type { ParserExtension } from '@stella/shared';

type Kinds = NonNullable<ParserExtension['kinds']>;

export const SUBJECTS: NonNullable<ParserExtension['subjects']> = [
  ['Mathe', ['mathe', 'mathematik', 'ma', 'math', 'maths', 'mathematics']],
  ['Deutsch', ['deutsch', 'de', 'dt', 'german']],
  ['Englisch', ['englisch', 'english', 'engl', 'en']],
  ['Latein', ['latein', 'lat', 'la', 'latin']],
  ['Französisch', ['französisch', 'franzoesisch', 'franz', 'frz', 'french']],
  ['Spanisch', ['spanisch', 'spa', 'span', 'spanish']],
  ['Italienisch', ['italienisch', 'ita', 'ital', 'italian']],
  ['Griechisch', ['griechisch', 'gr', 'greek']],
  ['Physik', ['physik', 'ph', 'physics']],
  ['Chemie', ['chemie', 'ch', 'chemistry']],
  ['Biologie', ['biologie', 'bio', 'bu', 'biology']],
  ['Geschichte', ['geschichte', 'gsk', 'gs', 'ge', 'history']],
  ['Geografie', ['geografie', 'geographie', 'geo', 'gwk', 'gw', 'geography']],
  ['Informatik', ['informatik', 'info', 'inf', 'computing', 'cs']],
  ['Musik', ['musik', 'mu', 'me', 'music']],
  ['Kunst', ['kunst', 'be', 'bildnerische', 'art']],
  ['Religion', ['religion', 'reli', 'rk', 'rel']],
  ['Ethik', ['ethik', 'eth', 'ethics']],
  ['Psychologie & Philosophie', ['psychologie', 'philosophie', 'psy', 'philo', 'pup', 'pp', 'psychology', 'philosophy']],
  ['Sport', ['sport', 'bsp', 'turnen', 'pe', 'gym']],
  ['Wirtschaft', ['wirtschaft', 'bwl', 'rw', 'rechnungswesen', 'economics', 'business']],
];

const SINGLE_LETTER: Record<string, string> = {
  m: 'Mathe', d: 'Deutsch', e: 'Englisch', l: 'Latein', f: 'Französisch', s: 'Spanisch', i: 'Italienisch',
};

const KINDS: Kinds = [
  ['homework', 'HÜ', ['hü', 'hue', 'hüs', 'hausübung', 'hausuebung', 'hausaufgabe', 'hausaufgaben', 'ha', 'hausi', 'hausis']],
  ['exam', 'Schularbeit', ['sa', 'schularbeit', 'klausur', 'ka']],
  ['exam', 'Test', ['test', 'vokabeltest', 'quiz', 'lzk', 'lernzielkontrolle']],
  ['exam', 'Prüfung', ['prüfung', 'pruefung', 'mündliche', 'mü', 'swh', 'stundenwiederholung']],
  ['assignment', 'Referat', ['referat', 'präsentation', 'praesentation', 'präsi']],
  ['assignment', 'Abgabe', ['abgabe', 'projekt', 'portfolio']],
];

const LABELS: Record<string, string> = {
  vokabeltest: 'Vokabeltest', quiz: 'Quiz', swh: 'Stundenwiederholung', stundenwiederholung: 'Stundenwiederholung',
  mü: 'Mitarbeitsüberprüfung', mündliche: 'Mündliche Prüfung', präsentation: 'Präsentation', praesentation: 'Präsentation',
  präsi: 'Präsentation', projekt: 'Projekt', portfolio: 'Portfolio', klausur: 'Klausur',
};

const KINDS_EN: Kinds = [
  ['homework', 'Homework', ['homework', 'hw', 'hws']],
  ['exam', 'Exam', ['exam', 'exams', 'midterm', 'final', 'finals']],
  ['exam', 'Test', ['test', 'tests', 'quiz', 'quizzes']],
  ['assignment', 'Presentation', ['presentation', 'talk']],
  ['assignment', 'Assignment', ['assignment', 'project', 'essay', 'report', 'paper']],
];

export const SUBJECT_EN: Record<string, string> = {
  Mathe: 'Math', Deutsch: 'German', Englisch: 'English', Latein: 'Latin', Französisch: 'French', Spanisch: 'Spanish', Italienisch: 'Italian',
  Griechisch: 'Greek', Physik: 'Physics', Chemie: 'Chemistry', Biologie: 'Biology', Geschichte: 'History', Geografie: 'Geography',
  Informatik: 'Computer Science', Musik: 'Music', Kunst: 'Art', Religion: 'Religion', Ethik: 'Ethics', 'Psychologie & Philosophie': 'Psychology & Philosophy',
  Sport: 'PE', Wirtschaft: 'Economics',
};

export const SCHOOL_PARSER: ParserExtension = {
  subjects: SUBJECTS, singleLetters: SINGLE_LETTER, kinds: KINDS, kindsEn: KINDS_EN, labels: LABELS, subjectNamesEn: SUBJECT_EN,
};
