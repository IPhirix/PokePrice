# Stop any running instance and wait until it's fully gone
$procs = Get-Process -Name "PokePrice","pokeprice" -ErrorAction SilentlyContinue
if ($procs) {
    $procs | Stop-Process -Force
    $procs | ForEach-Object { try { $_.WaitForExit(5000) } catch {} }
}
Start-Sleep -Milliseconds 500

# Build renderer
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed"; exit 1 }

# Package
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npx electron-builder --win --dir
if ($LASTEXITCODE -ne 0) { Write-Host "Package failed"; exit 1 }

# Launch (remove ELECTRON_RUN_AS_NODE so Electron doesn't exit immediately)
Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process ".\dist\win-unpacked\PokePrice.exe"
Write-Host "Launched successfully"
