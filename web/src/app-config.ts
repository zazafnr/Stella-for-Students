// Muss in main.tsx als Allererstes importiert werden: macht diese App zu „Stella for Students“ (Edition, eigene Speicher-Schlüssel)
// und lädt die Texte der Students-Edition in den Sprachkatalog.
import { configureApp } from '@stella/web-core/app.ts';
import { extendCatalogs, extendEditionCatalogs } from '@stella/shared';
import { STUDENTS_CATALOG, STUDENTS_OVERRIDES } from '../../server-plugin/src/catalog.ts';

configureApp({ edition: 'students', storagePrefix: 'students', name: 'Stella for Students' });
extendCatalogs(STUDENTS_CATALOG);
extendEditionCatalogs('students', STUDENTS_OVERRIDES);
