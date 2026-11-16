[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidateSet('standard20-medium','firstlight-medium','firstlight-high16k')][string]$Mode,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9][a-z0-9-]{0,79}$')][string]$Candidate,
 [ValidateSet('chrome','edge','chromium')][string]$Browser='chrome',
 [switch]$Isolated
)
$ErrorActionPreference='Stop'
if (-not $Isolated) { throw 'Finish all functional/browser/GPU work, close competing previews, then explicitly pass -Isolated.' }
$taskRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$taskVariables=@('PERF_ISOLATED','PERF_V9_MODE','PLAYWRIGHT_BASE_URL','PLAYWRIGHT_QA_CANDIDATE','PLAYWRIGHT_BROWSER')
$taskPrevious=@{}
foreach ($taskName in $taskVariables) { $taskPrevious[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process') }
Push-Location -LiteralPath $taskRoot
try {
 $env:PERF_ISOLATED='1'
 $env:PERF_V9_MODE=$Mode
 $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5191'
 $env:PLAYWRIGHT_QA_CANDIDATE=$Candidate
 $env:PLAYWRIGHT_BROWSER=$Browser
 $taskHarness=if ($Mode -eq 'standard20-medium') { 'tools/performance/v9-standard20.mjs' } else { 'tools/performance/v9-active-first-light.mjs' }
 # One fresh browser per explicit command; internal deadline is 360 seconds.
 # No build, server launch, product mutation, threshold override or result overwrite.
 & node $taskHarness
 if ($LASTEXITCODE -ne 0) { throw "V9 $Mode failed with exit code $LASTEXITCODE. Preserve its report and inspect it before any rerun." }
} finally {
 Pop-Location
 foreach ($taskName in $taskVariables) { [Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process') }
}
