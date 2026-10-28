# Run in PowerShell 7. This stays in the foreground; Ctrl+C stops the server.
param(
  [Parameter(Mandatory=$true)][string]$KeyFile,
  [string]$VoiceKeyFile,
  [ValidateRange(1024,65535)][int]$Port=9189
)
$ErrorActionPreference='Stop'
if (!(Test-Path -LiteralPath $KeyFile -PathType Leaf)) { throw 'The key file was not found.' }
$previousKeyFile=$env:FMC_OPENAI_KEY_FILE
$previousPort=$env:PORT
$previousVoiceFile=$env:FMC_VOICE_KEY_FILE
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  $env:FMC_OPENAI_KEY_FILE=(Resolve-Path -LiteralPath $KeyFile).Path
  $env:PORT=[string]$Port
  if ($VoiceKeyFile) { $env:FMC_VOICE_KEY_FILE=(Resolve-Path -LiteralPath $VoiceKeyFile).Path }
  node tools/serve.mjs
} finally {
  $env:FMC_OPENAI_KEY_FILE=$previousKeyFile
  $env:PORT=$previousPort
  $env:FMC_VOICE_KEY_FILE=$previousVoiceFile
  Pop-Location
}
