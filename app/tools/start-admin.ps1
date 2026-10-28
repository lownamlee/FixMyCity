# Starts only the laptop administration / preview service. The public app is independent.
param([ValidateRange(1024,65535)][int]$Port=9190)
$ErrorActionPreference='Stop'
$priorPort=$env:PORT
$priorMode=$env:FMC_DATABASE_MODE
$priorKey=$env:FMC_VOICE_KEY_FILE
Push-Location $PSScriptRoot
try {
  $env:PORT=[string]$Port
  $env:FMC_DATABASE_MODE='supabase'
  $taskKeyPath=Join-Path ([Environment]::GetFolderPath('Desktop')) 'apikey.txt'
  if(Test-Path -LiteralPath $taskKeyPath){$env:FMC_VOICE_KEY_FILE=$taskKeyPath}
  Write-Host "Admin workspace: http://127.0.0.1:$Port/admin"
  Write-Host 'Choose the admin-access.key file in your local FixMyCity configuration folder to unlock it.'
  node serve.mjs
} finally {
  $env:PORT=$priorPort
  $env:FMC_DATABASE_MODE=$priorMode
  $env:FMC_VOICE_KEY_FILE=$priorKey
  Pop-Location
}
