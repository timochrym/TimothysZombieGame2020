@echo off
rem Double-click to open the Control Panel (update, send my changes, restore points, open, repair).
rem It opens a window; no black console window stays open.
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
  start "" %PYW% "%~dp0control_panel.py" %*
  exit /b 0
)

rem No windowed Python: try a normal one and show any error in a message box.
set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if defined PY (
  %PY% "%~dp0control_panel.py" %* 2>"%TEMP%\control_panel_error.txt"
  if errorlevel 1 powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show((Get-Content -Raw $env:TEMP\control_panel_error.txt), 'Control Panel')"
  exit /b 0
)
powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('Python 3 is needed to open the Control Panel. Install it from https://www.python.org/downloads/ (tick Add python.exe to PATH), then open this again.', 'Control Panel')"
exit /b 1
