@echo off
rem Double-click to open the window that shows EVERY project on this computer: open any of them, update them, and
rem schedule updates. It is not attached to one project, so it works from here or from the Updater folder.
setlocal
cd /d "%~dp0"

set "PYW="
where pyw >nul 2>nul
if not errorlevel 1 set "PYW=pyw -3"
if not defined PYW (
  where pythonw >nul 2>nul
  if not errorlevel 1 set "PYW=pythonw"
)
if defined PYW (
  start "" %PYW% "%~dp0control_panel.py" --hub %*
  exit /b 0
)
set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if defined PY (
  %PY% "%~dp0control_panel.py" --hub %*
  exit /b 0
)
powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('Python 3 is needed. Install it from https://www.python.org/downloads/ (tick Add python.exe to PATH), then open this again.', 'All Projects')"
exit /b 1
