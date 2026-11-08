@echo off
rem Kept so old shortcuts and scheduled tasks still work.
rem It runs the same update as the Control Panel's Update button, as plain text.
setlocal
cd /d "%~dp0"
title Update

set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if defined PY (
  %PY% "%~dp0control_panel.py" --update --pause
  exit /b %errorlevel%
)

rem No Python: still fetch the latest files (the page is not rebuilt without Python).
where git >nul 2>nul
if errorlevel 1 (
  echo The update tool is not installed. Install it from https://git-scm.com/download/win
  echo then double-click this file again.
  pause
  exit /b 1
)
git pull --ff-only
pause
exit /b %errorlevel%
