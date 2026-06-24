$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$bundledRoot = "C:\Users\qq130\.cache\codex-runtimes\codex-primary-runtime\dependencies"
$bundledNode = Join-Path $bundledRoot "node\bin\node.exe"
$bundledPnpm = Join-Path $bundledRoot "bin\pnpm.cmd"

$systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
$systemPnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue

if ($systemNode) {
    $node = $systemNode.Source
} elseif (Test-Path $bundledNode) {
    $node = $bundledNode
} else {
    throw "Node.js was not found. Install Node.js 20+ or run this project inside Codex Desktop."
}

if ($systemPnpm) {
    $pnpm = $systemPnpm.Source
} elseif (Test-Path $bundledPnpm) {
    $pnpm = $bundledPnpm
} else {
    $pnpm = $null
}

if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
    if (-not $pnpm) {
        throw "Dependencies are missing and pnpm was not found. Install pnpm, then run this script again."
    }

    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & $pnpm install
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed with exit code $LASTEXITCODE."
    }
}

$xlsxFile = Get-ChildItem -LiteralPath (Join-Path $projectRoot "data") -Filter "*.xlsx" |
    Select-Object -First 1

if (-not $xlsxFile) {
    throw "No .xlsx file was found in the data directory."
}

Write-Host "Analyzing Excel data..." -ForegroundColor Cyan
& $node (Join-Path $projectRoot "scripts\analyze-data.mjs") $xlsxFile.FullName
if ($LASTEXITCODE -ne 0) {
    throw "Data analysis failed with exit code $LASTEXITCODE."
}

$vite = Join-Path $projectRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path $vite)) {
    throw "Vite was not found. Reinstall the project dependencies."
}

Write-Host ""
Write-Host "Dashboard is running at http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
& $node $vite --host 127.0.0.1 --port 5173
