# iOS: Stella for Students

`StellaStudents.swiftpm` ist die Studenten-App (Bundle `app.stella.students.ios`, Anzeigename „Stella for Students“, Akzent Violett, Kategorie Bildung).
Sie läuft gegen denselben Server wie Stella, meldet sich aber als Edition `students` an (Header `x-stella-edition`, Standard-Server
`students.stella.evolsior.com`); die Edition erkennt die App an der Bundle-ID (`API.edition` im Kern).

```
StellaStudents.swiftpm/
  App/      StellaStudentsApp.swift (Tab-Leiste inkl. Lernen), StudentsCatalogs.swift (erzeugt)
  Views/    Kopie der Ansichten von Stella, dazu LearnView.swift (Lernkarten, Mitschriften aus Fotos)
  Core/     KOPIE aus dem Kern-Spiegel (scripts/sync-ios.sh) – nie von Hand ändern
  Design/   KOPIE aus dem Kern-Spiegel (scripts/sync-ios.sh) – nie von Hand ändern
project.yml  XcodeGen: StellaStudents.xcodeproj mit Bildschirmzeit-Erweiterungen (Gruppe group.app.stella.students.ios)
Extensions/  StellaStudentsActivityMonitor, StellaStudentsActivityReport
Resources/   InfoPlist.strings je Sprache (Kamera, Fotos, Mikrofon, Standort)
```

- **Kern ändern** (Core/Design): immer im Repo `Stella-Life-Assistent` (`ios/Stella.swiftpm`), dort pushen, hier `npm run sync:core && scripts/sync-ios.sh`.
- **Texte**: neue Schlüssel in `server-plugin/i18n/*.json`, dann `npx tsx scripts/gen-ios-catalogs.ts`.
- **Swift Playgrounds**: den Ordner `StellaStudents.swiftpm` öffnen (Core/ und Design/ liegen physisch darin).
- **CI**: `.github/workflows/ios.yml` baut auf macOS, prüft Kataloge und Kopie, lädt zu Appetize hoch (Secret `APPETIZE_API_TOKEN`) und legt die
  Klick-Vorschau auf den Branch `ios-preview`. Beispieldaten: `scripts/demo-seed.mts`. Skill: `.claude/skills/ios-preview`.
- **Bildschirmzeit** (Family Controls) muss für diese Bundle-ID bei Apple extra beantragt werden.
- Die Anmelde-Links per Mail öffnen die App über Associated Domains (`login.stella.evolsior.com`); die Datei `apple-app-site-association` muss
  beide App-IDs nennen (Aufgabe des Betreibers, steht im Bericht).
