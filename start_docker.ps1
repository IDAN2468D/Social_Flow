param(
    [ValidateSet("backend", "infra", "kafka", "all")]
    [string]$Profile = "backend"
)

# Start SocialFlow ecosystem in Docker using resource-optimized profiles
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   SocialFlow - Docker Stack Launcher    " -ForegroundColor Yellow
Write-Host "   Active Profile: $Profile" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Stop local processes if they occupy the ports
$ports = @(8081, 8082, 8083, 8084, 8085, 8086, 8088, 9000, 9001)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $procId = $conn.OwningProcess | Select-Object -First 1
        if ($procId -gt 0) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -in @("java", "python")) {
                Write-Host "Stopping host process '$($proc.ProcessName)' (PID $procId) on port $p..." -ForegroundColor DarkYellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Start-Sleep -Seconds 1

# 2. Launch Docker Compose with selected profile
Write-Host "`nStarting SocialFlow containers (profile: $Profile)..." -ForegroundColor Cyan
docker compose --profile $Profile up -d

Write-Host "`nWaiting for services to become healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 3. Status summary
Write-Host "`n================ Docker Containers Status ================" -ForegroundColor Green
docker compose ps

Write-Host "`nAll Backend services are up and running!" -ForegroundColor Green
Write-Host "API Gateway:     http://localhost:8088" -ForegroundColor Yellow
Write-Host "User Service:    http://localhost:8081" -ForegroundColor Yellow
Write-Host "Post Service:    http://localhost:8082" -ForegroundColor Yellow
Write-Host "Feed Service:    http://localhost:8083" -ForegroundColor Yellow
Write-Host "Media Service:   http://localhost:8084" -ForegroundColor Yellow
Write-Host "Notification:    http://localhost:8085" -ForegroundColor Yellow
Write-Host "AI Service:      http://localhost:8086" -ForegroundColor Yellow
Write-Host "MinIO Console:   http://localhost:9001" -ForegroundColor Yellow
Write-Host "MinIO API (S3):  http://localhost:9000" -ForegroundColor Yellow
Write-Host "PostgreSQL:      localhost:5435" -ForegroundColor Yellow
Write-Host "Kafka:           localhost:9095" -ForegroundColor Yellow
Write-Host "Kafka UI:        http://localhost:8080" -ForegroundColor Yellow
Write-Host "Elasticsearch:   http://localhost:9205" -ForegroundColor Yellow
