#!/bin/bash
# Double-click to play over LAN (same Wi-Fi): starts the game's own server and opens the game, ready to host.
# Keep the Terminal window open while you play: closing it (or Ctrl+C) stops the server.
cd "$(dirname "$0")" || exit 1
xattr -d com.apple.quarantine ./*.command 2>/dev/null || true
chmod +x ./*.command 2>/dev/null || true
# Finder starts scripts with a short PATH: add the usual Node.js install places
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; fi
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "LAN play needs Node.js (free). The download page will open: install the LTS version, then double-click Start LAN Game again." buttons {"OK"} with title "Start LAN Game"' >/dev/null 2>&1 \
    || echo "LAN play needs Node.js: install it from https://nodejs.org then run this again."
  (open https://nodejs.org/en/download || xdg-open https://nodejs.org/en/download) >/dev/null 2>&1
  exit 1
fi
exec node server.js --open "$@"
