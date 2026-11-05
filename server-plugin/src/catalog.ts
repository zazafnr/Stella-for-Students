// Texte der Students-Edition in allen acht Sprachen (Stil: docs/i18n-stil.md im Kern). Server (`catalog`-Einhängepunkt)
// und Web-App laden dieselben Dateien.
import type { Locale } from '@stella/shared';
import en from '../i18n/en.json' with { type: 'json' };
import de from '../i18n/de.json' with { type: 'json' };
import es from '../i18n/es.json' with { type: 'json' };
import fr from '../i18n/fr.json' with { type: 'json' };
import it from '../i18n/it.json' with { type: 'json' };
import ptBR from '../i18n/pt-BR.json' with { type: 'json' };
import tr from '../i18n/tr.json' with { type: 'json' };
import pl from '../i18n/pl.json' with { type: 'json' };

export const STUDENTS_CATALOG: Record<Locale, Record<string, string>> = { en, de, es, fr, it, 'pt-BR': ptBR, tr, pl };

import oEn from '../i18n/overrides/en.json' with { type: 'json' };
import oDe from '../i18n/overrides/de.json' with { type: 'json' };
import oEs from '../i18n/overrides/es.json' with { type: 'json' };
import oFr from '../i18n/overrides/fr.json' with { type: 'json' };
import oIt from '../i18n/overrides/it.json' with { type: 'json' };
import oPtBR from '../i18n/overrides/pt-BR.json' with { type: 'json' };
import oTr from '../i18n/overrides/tr.json' with { type: 'json' };
import oPl from '../i18n/overrides/pl.json' with { type: 'json' };

/** Schulwörter statt der neutralen Texte des Kerns (gleiche Schlüssel); gelten nur für Konten der Edition students */
export const STUDENTS_OVERRIDES: Record<Locale, Record<string, string>> = { en: oEn, de: oDe, es: oEs, fr: oFr, it: oIt, 'pt-BR': oPtBR, tr: oTr, pl: oPl };
