@echo off
rem Run once if other devices can't open the game's LAN link. It asks for admin rights, then lets devices on
rem YOUR OWN network (local subnet only) reach Node.js, which runs the LAN server. It also removes the "block"
rem rule Windows creates if someone pressed Cancel on the "Allow Node.js?" prompt (a block always wins).
setlocal
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)
set "NODE="
for /f "delims=" %%n in ('where node 2^>nul') do if not defined NODE set "NODE=%%n"
if not defined NODE (
  echo Node.js was not found. Install it from https://nodejs.org first, then run this again.
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="Node.js JavaScript Runtime" >nul 2>&1
netsh advfirewall firewall delete rule name="Zombie Game LAN (Node.js)" >nul 2>&1
netsh advfirewall firewall add rule name="Zombie Game LAN (Node.js)" dir=in action=allow program="%NODE%" enable=yes profile=any remoteip=localsubnet
if errorlevel 1 (
  echo Could not add the firewall rule.
) else (
  echo.
  echo Done. Devices on your own network can now reach the game's LAN server.
  echo Still blocked? Check that your Wi-Fi is set to Private in Windows Settings ^> Network, and that
  echo antivirus software with its own firewall ^(Norton, McAfee, ...^) allows Node.js too.
)
echo.
pause
