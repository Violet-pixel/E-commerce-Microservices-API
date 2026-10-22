$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function New-Secret([int]$size) {
  $bytes = New-Object byte[] $size
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host 'Instale o Docker Desktop antes de continuar.'
  exit 1
}

if (-not (Test-Path .env)) {
  $db = New-Secret 18
  $sc = New-Secret 24
  (Get-Content .env.example) `
    -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$db" `
    -replace '^SERVICE_CLIENT_SECRET=.*', "SERVICE_CLIENT_SECRET=$sc" |
    Set-Content -Encoding ascii .env
  Write-Host 'Arquivo .env criado com senhas aleatorias.'
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$port = ((Get-Content .env | Where-Object { $_ -like 'APP_PORT=*' }) -split '=')[1]
if (-not $port) { $port = '8080' }
$url = "http://localhost:$port"

Write-Host 'Aguardando a API...'
for ($i = 0; $i -lt 90; $i++) {
  try {
    Invoke-WebRequest -UseBasicParsing "$url/health" -TimeoutSec 2 | Out-Null
    Write-Host "Cesto pronto em $url"
    Start-Process $url
    exit 0
  } catch {
    Start-Sleep -Seconds 2
  }
}
Write-Host 'A API demorou para responder. Veja: docker compose logs -f'
exit 1
