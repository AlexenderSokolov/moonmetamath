param(
  [string]$Out,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
)
$ErrorActionPreference = 'Stop'
$nodeArgs = @('scripts/demo.mjs')
if ($Out) { $nodeArgs += @('--out', $Out) }
if ($ScriptArgs) { $nodeArgs += $ScriptArgs }
Push-Location -LiteralPath $PSScriptRoot
try { & node @nodeArgs; $result = $LASTEXITCODE } finally { Pop-Location }
exit $result
