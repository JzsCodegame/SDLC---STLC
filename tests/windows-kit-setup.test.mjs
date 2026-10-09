import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('Windows bootstrap keeps compatible tools, repairs missing tools and stops on failure',async()=>{
 const root=await fs.mkdtemp(path.resolve('.local/windows-setup-test-'));
 const source=await fs.readFile('automation-lab/student-kit/Setup.ps1');
 await fs.writeFile(path.join(root,'Setup.ps1'),source);
 await fs.writeFile(path.join(root,'kit-manifest.json'),JSON.stringify({schemaVersion:1,files:[{path:'Setup.ps1',bytes:source.length,sha256:createHash('sha256').update(source).digest('hex')}]}));
 const script=`
$ErrorActionPreference='Stop'
Import-Module Microsoft.PowerShell.Utility
. (Join-Path $PSScriptRoot 'Setup.ps1')
function Refresh-LabPath {}
function Get-Command { param($Name,$ErrorAction) return @{Name=$Name} }
function Get-LabVersion { param($Tool) return $script:versions[$Tool] }
function node.exe { $global:LASTEXITCODE=0; $script:appInstalls++ }
function winget.exe {
 $script:installs++
 if ($script:failure) { $global:LASTEXITCODE=5; return }
 $id=$args[[Array]::IndexOf($args,'--id')+1]
 switch ($id) {
  'OpenJS.NodeJS.LTS' {$script:versions.Node='24.21.0'}
  'Git.Git' {$script:versions.Git='2.52.0'}
  'Microsoft.Edge' {$script:versions.Browser='154.0.0'}
  'Microsoft.VisualStudioCode' {$script:versions.Editor='1.140.0'}
 }
 $global:LASTEXITCODE=0
}
function Assert-Equal($actual,$expected) { if ($actual -ne $expected) {throw "Expected $expected, got $actual"} }
$script:versions=@{Node='24.14.0';Git='2.52.0';Browser='154.0.0';Editor='1.140.0'}
$script:installs=0; $script:appInstalls=0; $script:failure=$false
Invoke-LabSetup
Assert-Equal $script:installs 0
Assert-Equal $script:appInstalls 1
foreach ($tool in @('Node','Git','Browser','Editor')) { $script:versions[$tool]=$null }
Invoke-LabSetup
Assert-Equal $script:installs 4
Assert-Equal $script:appInstalls 2
# Re-running must not install compatible system tools again.
Invoke-LabSetup
Assert-Equal $script:installs 4
# Incompatible versions must take the installer path.
$script:versions.Git='2.20.0'
Invoke-LabSetup
Assert-Equal $script:installs 5
# A failed install must stop before app installation.
$script:versions.Git=$null; $script:failure=$true
$stopped=$false
try {Invoke-LabSetup} catch {$stopped=$true}
Assert-Equal $stopped $true
Assert-Equal $script:appInstalls 4
Assert-Equal (Test-LabVersion Node '26.0.0') $false
Assert-Equal (Test-LabVersion Node '24.21.0') $true
# Altered package contents must stop before installers run.
Add-Content -LiteralPath (Join-Path $PSScriptRoot 'Setup.ps1') -Value '# changed'
$before=$script:installs; $stopped=$false
try {Invoke-LabSetup} catch {$stopped=$true}
Assert-Equal $stopped $true
Assert-Equal $script:installs $before
Write-Output 'BOOTSTRAP FIXTURES PASSED; no system installations performed.'
`;
 await fs.writeFile(path.join(root,'test.ps1'),script);
 const output=execFileSync('powershell.exe',['-NoProfile','-File',path.join(root,'test.ps1')],{encoding:'utf8'});
 assert.match(output,/BOOTSTRAP FIXTURES PASSED/);
});
