@echo off
rem Double-click to play over LAN (same Wi-Fi): starts the game's own server and opens the game, ready to host.
rem Keep the window that opens: closing it stops the server.
setlocal
cd /d "%~dp0"
title Zombie Game LAN server - close this window to stop
where node >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('LAN play needs Node.js (free). The download page will open: install the LTS version, then double-click Start LAN Game again.', 'Start LAN Game')"
  start "" https://nodejs.org/en/download
  exit /b 1
)
node server.js --open %*
echo.
echo The LAN server has stopped.
pause
