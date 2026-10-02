@echo off
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS, close this window, and open a new PowerShell window.
  echo See README.md for the setup checklist. No settings were changed.
  if "%~1"=="" pause
  exit /b 1
)
node.exe "%~dp0lab.mjs" %*
exit /b %errorlevel%
