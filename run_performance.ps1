$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
& node scripts/fetch-performance-data.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node scripts/build.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node scripts/performance.mjs --engine dist/moonmetamath-core.mjs @args
exit $LASTEXITCODE
