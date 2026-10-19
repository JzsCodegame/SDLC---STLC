@echo off
setlocal
cd /d "%~dp0"
set "ACADEMY_SETUP_ROOT=%~dp0"
set "ACADEMY_SETUP_ARGS=%*"
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; try { Import-Module Microsoft.PowerShell.Utility -ErrorAction Stop; $root=$env:ACADEMY_SETUP_ROOT; $file=Join-Path $root 'Setup.ps1'; $manifest=Get-Content -LiteralPath (Join-Path $root 'kit-manifest.json') -Raw | ConvertFrom-Json; $entry=@($manifest.files | Where-Object { $_.path -eq 'Setup.ps1' }); if ($manifest.schemaVersion -ne 1 -or $entry.Count -ne 1) { throw 'Setup manifest entry is missing or duplicated. Extract the complete ZIP again.' }; $item=Get-Item -LiteralPath $file; if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $entry[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry[0].sha256) { throw 'Setup file verification failed. Extract the complete ZIP again.' }; Unblock-File -LiteralPath $file; $options=@{}; foreach ($option in ($env:ACADEMY_SETUP_ARGS -split '\s+')) { if (-not $option) { continue }; if ($option -notin @('-CheckOnly','-UpdateTools')) { throw 'Use Setup.cmd, Setup.cmd -CheckOnly or Setup.cmd -UpdateTools.' }; $options[$option.TrimStart('-')]=$true }; & $file @options; exit $LASTEXITCODE } catch { Write-Host $_.Exception.Message; Write-Host 'If your organization requires signed scripts, ask its administrator. Do not change execution policy.'; exit 1 }"
set "result=%errorlevel%"
if not "%result%"=="0" echo Setup did not finish. Read the error above. Your work is preserved.
pause
exit /b %result%
