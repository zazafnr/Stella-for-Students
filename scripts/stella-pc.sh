#!/usr/bin/env bash
# Stella for Students am PC (Linux/macOS) – nutzt die PC-Schicht aus Stella-Life-Assistent (ios/PC).
#   scripts/stella-pc.sh --demo        offline mit Beispieldaten
#   scripts/stella-pc.sh               gegen den echten Server
# Erwartet Stella-Life-Assistent daneben, sonst STELLA_REPO=/pfad/zu/Stella-Life-Assistent.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STELLA="${STELLA_REPO:-$(dirname "$ROOT")/Stella-Life-Assistent}"
SCRIPT="$STELLA/ios/PC/scripts/stella-pc.sh"
[ -x "$SCRIPT" ] || { echo "PC-Schicht nicht gefunden: $SCRIPT (Stella-Life-Assistent daneben klonen oder STELLA_REPO setzen)"; exit 1; }
exec "$SCRIPT" students --repo "$ROOT" "$@"
