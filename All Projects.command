#!/bin/bash
# Double-click to open the window that shows EVERY project on this computer: open any of them, update them, and
# schedule updates. It is not attached to one project, so it works from here or from the Updater folder.
cd "$(dirname "$0")" || exit 1
xattr -d com.apple.quarantine ./*.command 2>/dev/null || true
chmod +x ./*.command ./control_panel.py 2>/dev/null || true
if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display dialog "Python 3 is needed. Install it from python.org/downloads, then open this again." buttons {"OK"} with title "All Projects"' >/dev/null 2>&1 \
    || echo "Python 3 is needed. Install it from https://www.python.org/downloads/ then open this again."
  exit 1
fi
if python3 -c "import tkinter" >/dev/null 2>&1; then
  nohup python3 control_panel.py --hub "$@" >/dev/null 2>&1 &
  disown 2>/dev/null || true
  exit 0
fi
exec python3 control_panel.py --projects "$@"
