#!/usr/bin/env bash
# Kopiert Core/ und Design/ der iOS-App aus dem Kern-Spiegel (core/ios/Stella.swiftpm) in ios/StellaStudents.swiftpm.
# Swift Playgrounds braucht die Dateien physisch im Paket – deshalb eine eingecheckte Kopie statt eines Verweises.
#   scripts/sync-ios.sh           kopieren
#   scripts/sync-ios.sh --check   nur prüfen (CI)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=core/ios/Stella.swiftpm
DST=ios/StellaStudents.swiftpm
if [ "${1:-}" = "--check" ]; then
  for d in Core Design; do diff -r "$SRC/$d" "$DST/$d" >/dev/null || { echo "ios/StellaStudents.swiftpm/$d weicht vom Kern-Spiegel ab: scripts/sync-ios.sh ausführen."; exit 1; }; done
  echo "iOS-Kopie stimmt mit dem Kern-Spiegel überein."
else
  for d in Core Design; do rm -rf "$DST/$d"; cp -R "$SRC/$d" "$DST/$d"; done
  echo "iOS Core/ und Design/ aus dem Kern-Spiegel kopiert."
fi
