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
