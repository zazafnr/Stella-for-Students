// Einstieg des Edition-Plugins „students“. Der Stella-Server lädt diese Datei (STELLA_EDITION_STUDENTS) und ruft die
// Funktion mit der Plugin-API auf. Vom Kern werden nur **Typen** importiert (`import type …`); alles, was zur Laufzeit
// gebraucht wird, kommt über `api` herein – so teilen sich Server und Plugin genau eine Datenbank.
//
// Stand Paket 2: noch leer (`null` = „nichts beizutragen“, der Server nimmt sein eingebautes Schul-Plugin).
// Mit Paket 3 ziehen WebUntis, Schulbücher, HÜ-Autopilot, Handschrift und FreeNotes hierher.

import type { EditionPlugin, PluginApi } from '../core/server/src/plugin-api.ts';

export default function register(_api: PluginApi): EditionPlugin | null {
  return null;
}
