@echo off
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Double-click Setup.cmd in this folder first.
  echo Setup checks and installs the tools, then prepares your practice app.
  if "%~1"=="" pause
  exit /b 1
)
node.exe "%~dp0lab.mjs" %*
exit /b %errorlevel%
