@echo off
rem Double-click to start a NEW project that has its own Control Panel (and, if you like, its own online repository).
rem It asks a few questions in this window; nothing is changed until you have answered them.
setlocal
cd /d "%~dp0"
title New Project

set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if defined PY (
  %PY% "%~dp0control_panel.py" --new-project --pause %*
  exit /b %errorlevel%
)
echo Python 3 is needed. Install it from https://www.python.org/downloads/ (tick Add python.exe to PATH),
echo then double-click this file again.
pause
exit /b 1
