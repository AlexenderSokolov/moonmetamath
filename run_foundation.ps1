$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
foreach ($script in @('check', 'consumer', 'downstream', 'browser-check')) {
    & node "scripts/$script.mjs"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
