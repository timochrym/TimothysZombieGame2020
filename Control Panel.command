#!/bin/bash
# Double-click to open the Control Panel (update, send my changes, restore points, open, repair).
cd "$(dirname "$0")" || exit 1

# macOS blocks double-clicked scripts that arrived from the internet or Google
# Drive ("could not be verified"). Once you have allowed one launcher, it
# clears that flag from the others so you are only asked once.
xattr -d com.apple.quarantine ./*.command 2>/dev/null || true
# Google Drive drops the "may run" flag when these files sync from a Windows
# PC: put it back, and have the update tool ignore that flag, so it never reads as a change.
chmod +x ./*.command ./control_panel.py 2>/dev/null || true

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display dialog "Python 3 is needed to open the Control Panel. Install it from python.org/downloads, then open this again." buttons {"OK"} with title "Control Panel"' >/dev/null 2>&1 \
    || echo "Python 3 is needed. Install it from https://www.python.org/downloads/ then open this again."
  exit 1
fi

if python3 -c "import tkinter" >/dev/null 2>&1; then
  # Start the window and let this Terminal window finish.
  nohup python3 control_panel.py "$@" >/dev/null 2>&1 &
  disown 2>/dev/null || true
  exit 0
fi
# This Python has no window support: use the text menu instead.
exec python3 control_panel.py --no-gui "$@"
