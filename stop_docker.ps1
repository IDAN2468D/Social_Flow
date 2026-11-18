# Stop entire SocialFlow Docker Stack
Write-Host "Stopping all SocialFlow Docker containers..." -ForegroundColor Cyan
docker compose --profile all down --remove-orphans
Write-Host "All SocialFlow containers stopped successfully." -ForegroundColor Green
