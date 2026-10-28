param([int]$Port=54329)
$ErrorActionPreference='Stop'
$configDir=Join-Path $env:LOCALAPPDATA 'FixMyCity'
$configFile=Join-Path $configDir 'local-postgres.json'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
if(!(Test-Path -LiteralPath $configFile)) {
  $password=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  @{host='127.0.0.1';port=$Port;user='fixmycity';password=$password;database='fixmycity'} | ConvertTo-Json | Set-Content -LiteralPath $configFile
}
$config=Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
$existing=docker ps -a --filter 'name=^/fixmycity-local-postgres$' --format '{{.Names}}'
if($existing) { docker start fixmycity-local-postgres | Out-Null }
else {
  $previous=$env:POSTGRES_PASSWORD
  try {
    $env:POSTGRES_PASSWORD=$config.password
    docker run -d --name fixmycity-local-postgres --label app=fixmycity-local --restart unless-stopped -e POSTGRES_PASSWORD -e POSTGRES_USER=fixmycity -e POSTGRES_DB=fixmycity -p "127.0.0.1:$($config.port):5432" -v fixmycity-local-pgdata:/var/lib/postgresql/data postgres:17-alpine
    if($LASTEXITCODE -ne 0){throw 'PostgreSQL container did not start.'}
  } finally { $env:POSTGRES_PASSWORD=$previous }
}
Write-Output "Local PostgreSQL configured on 127.0.0.1:$($config.port). Credentials stay outside the website folder."
