# Aufbau: Stella for Students und der Kern

Dieses Repo ist die **Students-Edition** von Stella. Der Server, die Datenbank, Stripe und der VPS gehören zum Kern
(`zazafnr/Stella-Life-Assistent`); hier liegt nur, was Schule, Lehre und Studium betrifft. Der Gesamtplan steht in
[`plan/stella-students.md`](plan/stella-students.md).

Begriffe: **Edition** (`life` / `students`), **Edition-Plugin** (`server-plugin/`), **Kern-Spiegel** (`core/`).

## Ordner

| Ordner | Inhalt | Wer ändert es? |
|---|---|---|
| `core/` | **Kern-Spiegel**: Kopie von `shared/`, `server/`, (`web-core/` ab Paket 4), iOS `Core/` und `Design/` aus dem Kern. `core/CORE_COMMIT` nennt den gespiegelten Commit. | **Niemand von Hand.** Nur `npm run sync:core`. |
| `server-plugin/` | das Edition-Plugin: WebUntis, Schulbücher, HÜ-Autopilot, Handschrift, FreeNotes, Uni, Lernkarten, Mitschriften | hier |
| `web/` | die Studenten-Web-App | hier |
| `ios/` | Platz für die Studenten-iOS-App (noch nicht gebaut) | hier |

Die Website `evolsior.com/stella-students` wird im Kern gebaut (`site-src/students.body.html`, `scripts/build-site.py`).

## Warum eine Kopie?

Damit dieses Repo **allein** typprüfen, testen und in Swift Playgrounds laufen kann. Eine eingecheckte Kopie braucht keinen Verweis
auf ein anderes Repo; Swift Playgrounds findet die Dateien physisch im Paket.

- Jede kopierte Quelldatei trägt oben den Hinweis „Kern-Spiegel – nicht hier ändern, Änderungen in Stella-Life-Assistent“.
  (JSON-Dateien, etwa die Sprachkataloge, können keinen Kommentar tragen; sie werden trotzdem geprüft.)
- Die CI checkt den Kern auf dem Stand aus `core/CORE_COMMIT` aus und führt `npm run sync:core -- --check` aus. Weicht der Spiegel ab,
  schlägt sie fehl.

## Zwei Repos nebeneinander auschecken

```bash
git clone https://github.com/zazafnr/Stella-Life-Assistent
git clone https://github.com/zazafnr/Stella-for-Students
cd Stella-for-Students && npm install
```

`sync:core` sucht den Kern unter `../Stella-Life-Assistent` (anderer Ort: `STELLA_CORE_PATH`).

## Wo ändere ich was?

| Ich will … | Ort |
|---|---|
| neue Schul-/Uni-Funktion im Server | `server-plugin/` – nur über die Plugin-API (`core/server/src/plugin-api.ts`) |
| einen Einhängepunkt, den es nicht gibt | **Kern** (`server/src/editions/registry.ts`), committen, dann hier `npm run sync:core` |
| Parser, Aktionen, Lagebild, Abos, gemeinsame Oberfläche | **Kern**, dann `npm run sync:core` |
| Aussehen, Tabs, Texte der Students-App | `web/`, `ios/`, `server-plugin/i18n` |

Ablauf bei Kern-Änderungen: im Kern committen und pushen → hier `npm run sync:core` → `npm run typecheck && npm test` → committen.
`sync:core` weigert sich, einen Kern mit uncommitteten Änderungen zu spiegeln (nur lokal mit `--allow-dirty`, die CI würde das ablehnen).

## Wie das Plugin geladen wird

Der Server startet **einen** Prozess. Ist `editions/students/server-plugin/index.ts` da (oder `STELLA_EDITION_STUDENTS` zeigt darauf), importiert er
es und ruft `default(api)` auf. Das Plugin importiert vom Kern nur **Typen**; Datenbank, Aktionen, Benachrichtigungen, KI-Aufrufe usw. kommen über
das `api`-Objekt. So gibt es genau eine Datenbank, auch wenn der Spiegel hier eine zweite Kopie des Server-Codes enthält.

Ausgeliefert wird immer der **Kern**: sein Dockerfile, `deploy/install-vps.sh` und `scripts/deploy-vps.sh` holen dieses Repo beim Bauen
(`scripts/fetch-edition.sh`, **kein Git-Submodul** – `git archive` nimmt Submodule nicht mit und ein gepinnter Stand hinkt der Arbeit hinterher).

Migrationen des Plugins laufen in einem **eigenen** Zähler (Tabelle `edition_migrations`); `PRAGMA user_version` gehört dem Kern.
