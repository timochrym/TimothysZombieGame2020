#!/bin/bash
# Double-click to open the review website: every project, what is waiting on you, and a place to save your answers.
# It only works on this computer and stops by itself after 30 minutes without use. Leave this window open while you use it.
cd "$(dirname "$0")" || exit 1

# Same housekeeping as the Control Panel launcher: allow the other launchers once, and keep the "may run" flag.
xattr -d com.apple.quarantine ./*.command 2>/dev/null || true
chmod +x ./*.command 2>/dev/null || true

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display dialog "Python 3 is needed. Install it from python.org/downloads, then open this again." buttons {"OK"} with title "Review"' >/dev/null 2>&1 \
    || echo "Python 3 is needed. Install it from https://www.python.org/downloads/ then open this again."
  exit 1
fi

if [ ! -f .updater/panel_web.py ]; then
  osascript -e 'display dialog "Open the Control Panel once first so it downloads the latest Updater, then open this again." buttons {"OK"} with title "Review"' >/dev/null 2>&1 \
    || echo "Open the Control Panel once first so it downloads the latest Updater, then open this again."
  exit 1
fi

exec python3 .updater/panel_web.py --open --idle-minutes 30 "$@"
