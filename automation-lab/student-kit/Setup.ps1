param([switch]$CheckOnly, [switch]$UpdateTools)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Refresh-LabPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
function Get-LabVersion([string]$Tool) {
    switch ($Tool) {
        'Node' { if (Get-Command node.exe -ErrorAction SilentlyContinue) { return ((& node.exe --version) -replace '^v','') } }
        'Git' { if (Get-Command git.exe -ErrorAction SilentlyContinue) { return ((& git.exe --version) -replace '^git version ','') } }
        'Editor' {
            foreach ($root in @($env:LOCALAPPDATA,$env:ProgramFiles)) {
                foreach ($relative in @('Programs\Microsoft VS Code\Code.exe','Microsoft VS Code\Code.exe')) {
                    $file=Join-Path $root $relative
                    if (Test-Path -LiteralPath $file) { return (Get-Item -LiteralPath $file).VersionInfo.ProductVersion }
                }
            }
        }
        'Browser' {
            foreach ($root in @(${env:ProgramFiles(x86)},$env:ProgramFiles,$env:LOCALAPPDATA)) {
                foreach ($relative in @('Microsoft\Edge\Application\msedge.exe','Google\Chrome\Application\chrome.exe')) {
                    if (-not $root) { continue }
                    $file=Join-Path $root $relative
                    if (Test-Path -LiteralPath $file) {
                        $version=(Get-Item -LiteralPath $file).VersionInfo.ProductVersion
                        if ([version]($version -replace '[^0-9.].*$','') -ge [version]'140.0') { return $version }
                    }
                }
            }
        }
    }
    return $null
}
function Test-LabVersion([string]$Tool,[string]$Value) {
    if (-not $Value -or $Value -notmatch '^(\d+)\.(\d+)\.(\d+)') { return $false }
    $version=[version]$Matches[0]
    switch ($Tool) {
        'Node' { return $version.Major -eq 24 }
        'Git' { return $version -ge [version]'2.40.0' }
        'Editor' { return $version -ge [version]'1.90.0' }
        'Browser' { return $version -ge [version]'140.0.0' }
    }
    return $false
}
function Invoke-LabSetup {
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This kit requires Windows 10/11 x64.' }
    if (-not $CheckOnly) {
        $manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'kit-manifest.json') -Raw | ConvertFrom-Json
        if ($manifest.schemaVersion -ne 1 -or $manifest.files.Count -lt 1) { throw 'Invalid kit manifest. Extract the complete ZIP again.' }
        $kitPrefix=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')+'\'
        foreach ($entry in $manifest.files) {
            if ($entry.path -notmatch '^[A-Za-z0-9._ /-]+$' -or $entry.path -match '(^|/)\.\.(/|$)') { throw 'Unsafe manifest path.' }
            $file=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $entry.path))
            if (-not $file.StartsWith($kitPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path escapes the kit.' }
            $item=Get-Item -LiteralPath $file
            if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'A kit file is redirected. Re-extract into a normal local folder.' }
            if ($item.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Downloaded file changed: $($entry.path). Extract the complete verified ZIP again." }
        }
        Write-Host 'PASS: Downloaded kit files verified before installing tools.'
    }
    Write-Host 'STEP 1 OF 2: Check Windows tools (Node 24, Git, browser and VS Code).'
    $tools=@(
        @{Name='Node';Id='OpenJS.NodeJS.LTS';Version='24.20.0'},
        @{Name='Git';Id='Git.Git';Version=$null},
        @{Name='Browser';Id='Microsoft.Edge';Version=$null},
        @{Name='Editor';Id='Microsoft.VisualStudioCode';Version=$null}
    )
    foreach ($tool in $tools) {
        Refresh-LabPath
        $before=Get-LabVersion $tool.Name
        $compatible=Test-LabVersion $tool.Name $before
        if ($compatible -and (-not $UpdateTools -or $tool.Name -eq 'Node')) { Write-Host "PASS: $($tool.Name) $before is compatible; keeping it."; continue }
        if ($CheckOnly) { throw "$($tool.Name) needs installation/update. Double-click Setup.cmd to fix it." }
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'Windows App Installer (winget) is missing. Install/update App Installer from Microsoft Store, then run Setup.cmd again.' }
        Write-Host "INSTALL/UPDATE: $($tool.Name). Windows may ask you to approve its installer."
        $action=if ($compatible -and $UpdateTools) { 'upgrade' } else { 'install' }
        $arguments=@($action,'--exact','--id',$tool.Id,'--source','winget','--accept-source-agreements','--accept-package-agreements')
        if ($tool.Version) { $arguments+=@('--version',$tool.Version) }
        & winget.exe @arguments
        $installerResult=$LASTEXITCODE
        Refresh-LabPath
        $after=Get-LabVersion $tool.Name
        if (-not (Test-LabVersion $tool.Name $after)) { throw "$($tool.Name) verification failed (installer exit $installerResult). Close and reopen Setup.cmd. If it still fails, share the error with your instructor." }
        # APPINSTALLER_CLI_ERROR_UPDATE_NOT_APPLICABLE means no newer version exists.
        if ($installerResult -ne 0 -and -not ($compatible -and $installerResult -eq -1978335189)) { throw "$($tool.Name) installer reported $installerResult; installation is not accepted. Reopen Setup.cmd and retry." }
        Write-Host "PASS: $($tool.Name) $after verified."
    }
    if ($CheckOnly) { Write-Host 'Windows tools check succeeded. No installation performed.'; return }
    Write-Host 'STEP 2 OF 2: Install the practice app and its pinned Playwright/Cypress tools.'
    & node.exe (Join-Path $PSScriptRoot 'lab.mjs') install
    if ($LASTEXITCODE -ne 0) { throw 'Practice app installation failed. Read the error above, then run Setup.cmd again.' }
    Write-Host 'SETUP SUCCEEDED. Next: open this folder in PowerShell and run .\Lab.cmd test playwright-headed'
}
if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-LabSetup } catch { Write-Host "SETUP STOPPED: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
}
