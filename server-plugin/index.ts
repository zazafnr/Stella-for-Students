// Einstieg des Edition-Plugins „students“. Der Stella-Server lädt diese Datei (editions/students/server-plugin oder
// STELLA_EDITION_STUDENTS) und ruft die Funktion mit der Plugin-API auf. Vom Kern werden nur **Typen** importiert;
// alles, was zur Laufzeit gebraucht wird, kommt über `api` herein – so teilen sich Server und Plugin genau eine Datenbank.

import type { EditionPlugin, PluginApi } from '../core/server/src/plugin-api.ts';
import { bind } from './src/runtime.ts';
import { studentsPlugin } from './src/plugin.ts';

export default function register(api: PluginApi): EditionPlugin {
  bind(api);
  return studentsPlugin;
}
