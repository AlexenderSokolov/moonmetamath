param(
  [ValidateSet('local', 'publication')][string]$Phase = 'local',
  [string]$Gate,
  [string]$Out,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
)
$ErrorActionPreference = 'Stop'
$nodeArgs = @('scripts/acceptance.mjs', '--phase', $Phase)
if ($Gate) { $nodeArgs += @('--gate', $Gate) }
if ($Out) { $nodeArgs += @('--out', $Out) }
if ($ScriptArgs) { $nodeArgs += $ScriptArgs }
Push-Location -LiteralPath $PSScriptRoot
try { & node @nodeArgs; $result = $LASTEXITCODE } finally { Pop-Location }
exit $result
