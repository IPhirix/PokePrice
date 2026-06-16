npm run build:win
if ($LASTEXITCODE -eq 0) {
    Start-Process "dist\PokePrice.exe"
} else {
    Write-Host "Build failed - exe not launched." -ForegroundColor Red
}
