param(
  [string]$Task,
  [string]$Out,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
)
$ErrorActionPreference = 'Stop'
$nodeArgs = @('scripts/check.mjs')
if ($Task) { $nodeArgs += @('--task', $Task) }
if ($Out) { $nodeArgs += @('--out', $Out) }
if ($ScriptArgs) { $nodeArgs += $ScriptArgs }
Push-Location -LiteralPath $PSScriptRoot
try { & node @nodeArgs; $result = $LASTEXITCODE } finally { Pop-Location }
exit $result
