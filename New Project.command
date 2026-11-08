#!/bin/bash
# Double-click to start a NEW project that has its own Control Panel (and, if you like, its own online repository).
# It asks a few questions in this window; nothing is changed until you have answered them.
cd "$(dirname "$0")" || exit 1
xattr -d com.apple.quarantine ./*.command 2>/dev/null || true
chmod +x ./*.command ./control_panel.py 2>/dev/null || true

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display dialog "Python 3 is needed. Install it from python.org/downloads, then open this again." buttons {"OK"} with title "New Project"' >/dev/null 2>&1 \
    || echo "Python 3 is needed. Install it from https://www.python.org/downloads/ then open this again."
  exit 1
fi
exec python3 control_panel.py --new-project --pause "$@"
