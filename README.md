# ✦ Stella for Students

**Stella für Schule, Lehre und Studium.**

*Stella by **EVOLSIOR** – Built to become.*

Hier entsteht die zweite Stella: dieselbe Assistentin, aber ganz auf Schule und Uni zugeschnitten.
Stundenplan und Entfall, Hausübungen mit Autopilot und eigener Handschrift, Schulbücher, Prüfungen mit
Lernplan, Lernkarten mit Wiederholung, Mitschriften aus Fotos, Semester, Kurse und Noten – dazu alles,
was das normale Stella auch kann: Chat, Planer, Kalender, Mails, Ziele, Listen, Gesundheit, News, Wetter,
Telegram.

Das normale Stella (Alltag und Beruf) liegt in [`zazafnr/Stella-Life-Assistent`](https://github.com/zazafnr/Stella-Life-Assistent)
und verliert dafür alles Schulische.

| | |
|---|---|
| Web-App | `students.stella.evolsior.com` |
| iOS-App | Stella for Students (`app.stella.students.ios`) |
| Website | `evolsior.com/stella-students` |
| Server | derselbe wie beim normalen Stella (ein VPS, eine Datenbank, ein Stripe) |
| Konto | eigenes Konto, getrennt vom normalen Stella |

## Stand

Noch nichts gebaut. Der vollständige Arbeitsplan steht in
**[`docs/plan/stella-students.md`](docs/plan/stella-students.md)** – Paket 0 bis 16, der Reihe nach
abzuarbeiten. Dieselbe Datei liegt auch im Repo des normalen Stella.

Kurzfassung des geplanten Aufbaus:

```
core/            READ-ONLY Spiegel des gemeinsamen Kerns aus Stella-Life-Assistent
                 (nie hier ändern – Änderungen gehören ins andere Repo)
server-plugin/   WebUntis, Schulbücher, HÜ-Autopilot, Handschrift, FreeNotes,
                 Semester/Uni, Lernkarten, Mitschriften – wird vom gemeinsamen Server geladen
web/             die Studenten-Web-App (eigene Oberfläche, eigenes Theme)
ios/             StellaStudents.swiftpm (SwiftUI, Swift Playgrounds)
site-src/        die Bausteine für evolsior.com/stella-students
```

## Rechte

© 2026 zaza.dev – **Alle Rechte vorbehalten.** Der Code ist zum Anschauen öffentlich, aber nicht frei
lizenziert: Kopieren, Weitergeben oder Verwenden in eigenen Projekten ist ohne schriftliche Erlaubnis
nicht gestattet.
