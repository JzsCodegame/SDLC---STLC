# Invoked as verified inline PowerShell by Setup.cmd, never as a .ps1 execution entry.
function Get-AcademyGit {
    $roots = @()
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramW6432)) {
        if ($base) { $roots += Join-Path $base 'Git' }
    }
    if ($env:LOCALAPPDATA) { $roots += Join-Path $env:LOCALAPPDATA 'Programs\Git' }
    foreach ($registry in @('HKCU:\SOFTWARE\GitForWindows','HKLM:\SOFTWARE\GitForWindows')) {
        $entry = Get-ItemProperty -LiteralPath $registry -ErrorAction SilentlyContinue
        if ($entry -and $entry.InstallPath) { $roots += $entry.InstallPath }
    }
    $command = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($command) { $roots += Split-Path (Split-Path $command.Source -Parent) -Parent }
    foreach ($root in ($roots | Select-Object -Unique)) {
        $git = Join-Path $root 'cmd\git.exe'
        $bash = Join-Path $root 'bin\bash.exe'
        if (-not (Test-Path -LiteralPath $git -PathType Leaf) -or -not (Test-Path -LiteralPath $bash -PathType Leaf)) { continue }
        $version = & $git --version 2>$null
        if ($LASTEXITCODE -ne 0 -or $version -notmatch '^git version (\d+\.\d+\.\d+)') { continue }
        if ([version]$Matches[1] -lt [version]'2.40.0') { continue }
        & $bash --version 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return [pscustomobject]@{ Git = $git; Bash = $bash; Version = $version } }
    }
    return $null
}
function Assert-AcademyKit([string]$Root) {
    if ((Get-Item -LiteralPath $Root).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The kit folder is redirected. Extract into a normal local folder.' }
    $manifest = Get-Content -LiteralPath (Join-Path $Root 'kit-manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or $manifest.files.Count -lt 1) { throw 'Invalid kit manifest. Extract the complete ZIP again.' }
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $seen = @{}
    foreach ($entry in $manifest.files) {
        if ($entry.path -notmatch '^[A-Za-z0-9._ /-]+$' -or $entry.path -match '(^|/)\.\.(/|$)' -or $seen.ContainsKey($entry.path.ToLowerInvariant())) { throw 'Unsafe or duplicate kit manifest path.' }
        $seen[$entry.path.ToLowerInvariant()] = $true
        $file = [IO.Path]::GetFullPath((Join-Path $Root $entry.path))
        if (-not $file.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Kit file escapes the extracted folder.' }
        $cursor = $Root
        foreach ($part in ($entry.path -split '/')) {
            $cursor = Join-Path $cursor $part
            $item = Get-Item -LiteralPath $cursor
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'A kit path is redirected. Extract into a normal local folder.' }
        }
        if ($item.PSIsContainer -or $item.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Downloaded file changed: $($entry.path). Extract the complete ZIP again." }
    }
    foreach ($required in @('Setup.sh','WindowsBootstrap.ps1','lab.mjs')) {
        if (-not $seen.ContainsKey($required.ToLowerInvariant())) { throw "Missing kit manifest entry: $required" }
    }
    Write-Host 'PASS: Extracted kit files verified before any installation.'
}
function Assert-AcademyGitInstaller([string]$Installer) {
    $expected = '52188f917b378f00c70ec136bcf090005f30d44fbc4eba0bce759cc6592d60f6'
    if ((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash -ne $expected) { throw 'Official Git installer hash mismatch. Nothing was installed.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $Installer
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne 'C4BA1DE1C1B6049CF0E3FB393640685052199AEB') { throw 'Official Git installer signature validation failed. Nothing was installed.' }
}
function Install-AcademyGit {
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('Academy-Git-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $directory -ErrorAction Stop | Out-Null
    $installer = Join-Path $directory 'Git-2.56.0.2-64-bit.exe'
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Write-Host 'Git Bash is missing or unsupported. Downloading the pinned official Git for Windows installer.'
        Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.2/Git-2.56.0.2-64-bit.exe' -OutFile $installer
        Assert-AcademyGitInstaller $installer
        $destination = Join-Path $env:LOCALAPPDATA 'Programs\Git'
        Write-Host 'Verified installer. Installing Git for this Windows user only.'
        $arguments = @('/CURRENTUSER','/VERYSILENT','/NORESTART','/SUPPRESSMSGBOXES','/NOCANCEL','/SP-',('/DIR="' + $destination + '"'))
        $process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -ne 0) { throw "Git installation stopped (exit $($process.ExitCode)). Read any Windows approval prompt, then rerun Setup.cmd." }
    } finally {
        if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }
        Remove-Item -LiteralPath $directory -Force
    }
}
function Invoke-AcademyBootstrap {
    $ErrorActionPreference = 'Stop'
    Import-Module Microsoft.PowerShell.Utility -ErrorAction Stop
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This kit requires Windows 10/11 x64.' }
    $root = $env:ACADEMY_SETUP_ROOT
    if (-not $root) { throw 'Run Setup.cmd from the extracted kit.' }
    $flags = @()
    foreach ($option in ($env:ACADEMY_SETUP_ARGS -split '\s+')) {
        if (-not $option) { continue }
        switch ($option) {
            '-CheckOnly' { $flags += '--check-only' }
            '-UpdateTools' { $flags += '--update-tools' }
            default { throw 'Use Setup.cmd, Setup.cmd -CheckOnly or Setup.cmd -UpdateTools.' }
        }
    }
    Assert-AcademyKit $root
    $git = Get-AcademyGit
    if (-not $git) {
        if ($flags -contains '--check-only') { throw 'Git Bash is not ready. Run Setup.cmd without -CheckOnly to install it.' }
        Install-AcademyGit
        $git = Get-AcademyGit
        if (-not $git) { throw 'Git Bash could not be verified after installation. Reopen Setup.cmd; ask your administrator if this computer blocks installations.' }
    } else { Write-Host ('PASS: Compatible Git Bash is already installed; keeping it. ' + $git.Version) }
    $env:ACADEMY_GIT_BIN = Split-Path $git.Git -Parent
    Write-Host 'Starting the bundled Setup.sh automatically. No manual Git Bash steps are needed.'
    Push-Location -LiteralPath $root
    try {
        & $git.Bash -- './Setup.sh' @flags
        if ($LASTEXITCODE -ne 0) { throw "Bundled Setup.sh stopped (exit $LASTEXITCODE). Read the first error above. Your work is preserved." }
    } finally { Pop-Location }
}
