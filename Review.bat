@echo off
rem Double-click to open the review website: every project, what is waiting on you, and a place to save your answers.
rem It only works on this computer and stops by itself after 30 minutes without use. Leave this window open while you use it.
setlocal
cd /d "%~dp0"

if not exist ".updater\panel_web.py" (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('Open the Control Panel once first so it downloads the latest Updater, then open this again.', 'Review')"
  exit /b 1
)

set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('Python 3 is needed. Install it from https://www.python.org/downloads/ (tick Add python.exe to PATH), then open this again.', 'Review')"
  exit /b 1
)
%PY% ".updater\panel_web.py" --open --idle-minutes 30 %*
