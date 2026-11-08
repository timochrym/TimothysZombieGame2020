#!/bin/bash
# Kept so old shortcuts and scheduled tasks still work.
# It runs the same update as the Control Panel's Update button, as plain text.
cd "$(dirname "$0")" || exit 1
xattr -d com.apple.quarantine ./*.command 2>/dev/null || true
chmod +x ./*.command 2>/dev/null || true

if command -v python3 >/dev/null 2>&1; then
  exec python3 control_panel.py --update --pause
fi

# No Python: still fetch the latest files (the page is not rebuilt without Python).
if ! command -v git >/dev/null 2>&1; then
  echo "The update tool is not installed. Run: xcode-select --install"
  echo "then double-click this file again."
  exit 1
fi
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fileMode GIT_CONFIG_VALUE_0=false
git pull --ff-only
