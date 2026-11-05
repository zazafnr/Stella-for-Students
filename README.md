# Stella for Students

Der Assistent für **Schule, Lehre und Studium**: Stundenplan mit Entfall (WebUntis oder ICS-Abo), Hausübungen mit
Autopilot und Handschrift, Schulbücher, Prüfungen mit Lernplan, Semester und Noten, Lernkarten mit Wiederholung,
Mitschriften aus Fotos – dazu alles, was auch das normale Stella kann (Chat, Planer, Kalender, Inbox, Briefing …).

| | Stella | Stella for Students |
|---|---|---|
| Für wen | Alltag, Beruf, Haushalt | Schule, Lehre, Studium |
| Repo | `zazafnr/Stella-Life-Assistent` | **dieses Repo** |
| Web-App | `stella.evolsior.com` | `students.stella.evolsior.com` |
| iOS | `app.stella.ios` | `app.stella.students.ios` |

Beide Apps teilen **einen Server, eine Datenbank, ein Stripe und einen VPS**, aber nicht den Code der Oberfläche.
Konten sind getrennt: ein Students-Konto meldet sich nur hier an.

## Wie dieses Repo zum Kern steht

Die Begriffe sind überall gleich: **Edition** (`life` oder `students`), **Edition-Plugin** (der Code in
`server-plugin/`, den der Server lädt) und **Kern-Spiegel** (`core/`).

```
core/             READ-ONLY Spiegel von Stella-Life-Assistent (Kern-Spiegel) – nie von Hand ändern
server-plugin/    das Edition-Plugin: WebUntis, Bücher, HÜ-Autopilot, Handschrift, FreeNotes, Uni, Lernkarten …
web/              die Studenten-Web-App (eigene Shell, eigenes Theme, eigene Tabs)
ios/              Platz für die Studenten-iOS-App (noch nicht gebaut, siehe Bericht)
docs/             Plan und Aufbau
```

- **Änderungen am Kern** (Parser, Aktionen, Lagebild, Abos, gemeinsame Oberflächen) passieren **immer** in
  `Stella-Life-Assistent`. Danach `npm run sync:core` hier ausführen.
- Ausgeliefert wird immer `Stella-Life-Assistent`; es holt dieses Repo beim Bauen nach `editions/students` (`scripts/fetch-edition.sh`, kein Git-Submodul). Die Web-App baut dort `npm run build:students`.
- Die Website `evolsior.com/stella-students` liegt im Kern-Repo (`site-src/students.body.html`).
- Ohne dieses Plugin läuft das normale Stella vollständig.

Der Plan für diese Aufteilung steht in [`docs/plan/stella-students.md`](docs/plan/stella-students.md)
(dieselbe Datei liegt im Kern-Repo). Wie die beiden Repos zusammenspielen: [`docs/AUFBAU.md`](docs/AUFBAU.md).

## Starten

Beide Repos nebeneinander auschecken:

```bash
git clone https://github.com/zazafnr/Stella-Life-Assistent
git clone https://github.com/zazafnr/Stella-for-Students
```

Entwickeln gegen den eigenen Spiegel:

```bash
cd Stella-for-Students
npm install
npm run sync:core            # Kern-Spiegel aus ../Stella-Life-Assistent erzeugen
npm run dev           # Studenten-Web-App
```

Prüfen:

```bash
npm run sync:core -- --check && npx tsc -p server-plugin --noEmit && npx tsc -p web --noEmit && npm test
```

Der Stand der Arbeit, die offenen Punkte und die Aufgaben für den Betreiber (Apple-Konto, Stripe-Preise, DNS)
stehen in [`docs/plan/stella-students-bericht.md`](docs/plan/stella-students-bericht.md).
