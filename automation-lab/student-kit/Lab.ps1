param([Parameter(ValueFromRemainingArguments=$true)][string[]]$LabArguments)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw 'Install Node.js 24 LTS, then open a new PowerShell window. See README.md.'
}
& node.exe (Join-Path $PSScriptRoot 'lab.mjs') @LabArguments
exit $LASTEXITCODE
