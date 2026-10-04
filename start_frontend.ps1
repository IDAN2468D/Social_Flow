# Launch SocialFlow Frontend on http://localhost:3000
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   SocialFlow Frontend - Web Interface   " -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan

$port = 3000
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "Frontend server is already listening on port $port." -ForegroundColor Green
} else {
    Write-Host "Starting HTTP server on port $port..." -ForegroundColor Cyan
    Start-Process -NoNewWindow python -ArgumentList "-m http.server $port --directory frontend"
    Start-Sleep -Seconds 2
}

Write-Host "`nOpen SocialFlow in your browser at:" -ForegroundColor Green
Write-Host "http://localhost:3000" -ForegroundColor Yellow

Start-Process "http://localhost:3000"
