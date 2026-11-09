# Launch SocialFlow Next.js 15 Frontend on http://localhost:3000
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   SocialFlow Next.js 15 App - Web Interface     " -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

$port = 3000
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "Frontend server is already listening on port $port." -ForegroundColor Green
} else {
    Write-Host "Starting Next.js development server on port $port..." -ForegroundColor Cyan
    Set-Location -Path "$PSScriptRoot\frontend"
    Start-Process -NoNewWindow cmd -ArgumentList "/c npm run dev"
    Start-Sleep -Seconds 3
    Set-Location -Path "$PSScriptRoot"
}

Write-Host "`nOpen SocialFlow in your browser at:" -ForegroundColor Green
Write-Host "http://localhost:3000" -ForegroundColor Yellow

Start-Process "http://localhost:3000"
