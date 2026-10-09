@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0Setup.ps1" %*
set "result=%errorlevel%"
if not "%result%"=="0" echo Setup did not finish. Read the error above. Your work is preserved.
pause
exit /b %result%
