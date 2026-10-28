$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not $env:FMC_AI_SERVICE_TOKEN -or $env:FMC_AI_SERVICE_TOKEN.Length -lt 32) { throw 'Set FMC_AI_SERVICE_TOKEN to a private value of at least 32 characters.' }
if (-not $env:FMC_AI_REVIEW_DB) { throw 'Set FMC_AI_REVIEW_DB to a private database path.' }
python -m uvicorn main:app --host 127.0.0.1 --port 9193
