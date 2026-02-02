$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Print-Step($message) {
    Write-Host ""
    Write-ColorOutput Blue "==================================================="
    Write-ColorOutput Yellow $message
    Write-ColorOutput Blue "==================================================="
}

function Print-Success($message) {
    Write-ColorOutput Green "$message"
}

function Print-Error($message) {
    Write-ColorOutput Red "$message"
}

function Print-Info($message) {
    Write-ColorOutput Cyan "$message"
}

if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$APP_MODE = if ($env:APP_MODE) { $env:APP_MODE } else { "development" }

if ($APP_MODE -eq "production") {
    $COMPOSE_FILE = "docker-compose.production.yml"
    $OTHER_COMPOSE_FILE = "docker-compose.development.yml"
} else {
    $COMPOSE_FILE = "docker-compose.development.yml"
    $OTHER_COMPOSE_FILE = "docker-compose.production.yml"
}

$CACHEBUST = [int](Get-Date -UFormat %s)
$env:CACHEBUST = $CACHEBUST

Print-Step "Starting Deployment"
Print-Info "CACHEBUST: $CACHEBUST"
Print-Info "APP_MODE: $APP_MODE"
Print-Info "Compose file: $COMPOSE_FILE"
Print-Info "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

if ($APP_MODE -eq "production") {
    Print-Step "Building Frontend for Production"
    Push-Location ./frontend
    
    try {
        Print-Info "Cleaning ALL caches and old build..."
        if (Test-Path dist) { Remove-Item -Recurse -Force dist }
        if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
        if (Test-Path .vite) { Remove-Item -Recurse -Force .vite }
        if (Test-Path node_modules/.cache) { Remove-Item -Recurse -Force node_modules/.cache }
        
        Print-Info "Installing fresh dependencies (including devDependencies)..."
        $env:APP_MODE = "development"
        $npmInstall = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -Wait -PassThru
        
        if ($npmInstall.ExitCode -eq 0) {
            Print-Success "Dependencies installed"
        } else {
            Print-Error "Failed to install dependencies"
            Pop-Location
            exit 1
        }
        
        $env:APP_MODE = "production"
        
        Print-Info "Building fresh production bundle..."
        $npmBuild = Start-Process -FilePath "npm" -ArgumentList "run", "build" -NoNewWindow -Wait -PassThru
        
        if ($npmBuild.ExitCode -eq 0) {
            Print-Success "Frontend build completed!"
            
            if ((Test-Path dist) -and (Test-Path dist/index.html)) {
                Print-Info "Built files:"
                Get-ChildItem dist/assets/index-*.js | Select-Object -First 5 | ForEach-Object {
                    Print-Info "  $($_.Name) - $([math]::Round($_.Length / 1KB, 2)) KB"
                }
                
                $indexFile = Get-ChildItem dist/assets/index-*.js | Select-Object -First 1
                if ($indexFile) {
                    Print-Info "New JS file: $($indexFile.Name)"
                }
            } else {
                Print-Error "Build output is incomplete"
                Pop-Location
                exit 1
            }
        } else {
            Print-Error "Frontend build failed"
            Pop-Location
            exit 1
        }
    } finally {
        Pop-Location
    }
}

Print-Step "Cleaning Docker Build Cache"
Print-Info "Pruning Docker builder cache..."
docker builder prune -a -f
Print-Success "Docker build cache cleaned"

Print-Step "Current Docker Disk Usage"
docker system df

Print-Step "Stopping All Containers (Both Environments)"

Print-Info "Stopping $APP_MODE containers..."
try {
    docker compose -f $COMPOSE_FILE down 2>&1 | Out-Null
    Print-Success "$APP_MODE containers stopped"
} catch {
    Print-Info "No $APP_MODE containers running"
}

Print-Info "Stopping other environment containers..."
try {
    docker compose -f $OTHER_COMPOSE_FILE down 2>&1 | Out-Null
    Print-Success "Other environment containers stopped"
} catch {
    Print-Info "No other environment containers running"
}

if ($APP_MODE -eq "production") {
    Print-Step "Cleaning Frontend Volume"
    Print-Info "Removing old frontend_dist volume..."
    try {
        docker volume rm managementapplication_frontend_dist 2>&1 | Out-Null
        Print-Success "Frontend volume removed"
    } catch {
        Print-Info "Volume doesn't exist or already removed"
    }
    Print-Success "Frontend volume cleaned"
}

Print-Step "Removing Old Project Images"
$oldImages = docker images | Select-String "managementapplication"
if ($oldImages) {
    $imageCount = ($oldImages | Measure-Object).Count
    Print-Info "Found $imageCount old images"
    
    $oldImages | ForEach-Object {
        $imageId = ($_ -split '\s+')[2]
        try {
            docker rmi -f $imageId 2>&1 | Out-Null
        } catch {
        }
    }
    Print-Success "Old images removed"
} else {
    Print-Info "No old images to remove"
}

Print-Step "Building Images"
try {
    $env:CACHEBUST = $CACHEBUST
    $buildProcess = Start-Process -FilePath "docker" -ArgumentList "compose", "-f", $COMPOSE_FILE, "build", "--build-arg", "APP_MODE=$APP_MODE" -NoNewWindow -Wait -PassThru
    
    if ($buildProcess.ExitCode -eq 0) {
        Print-Success "Images built successfully"
    } else {
        Print-Error "Build failed"
        exit 1
    }
} catch {
    Print-Error "Build failed: $_"
    exit 1
}

Print-Step "Cleaning Up Docker Resources"
Print-Info "Removing dangling images..."
docker image prune -f
Print-Info "Removing stopped containers..."
docker container prune -f
Print-Info "Removing unused networks..."
docker network prune -f
Print-Success "Cleanup completed"

Print-Step "New Docker Disk Usage"
docker system df

Print-Step "Starting Containers"
try {
    $upProcess = Start-Process -FilePath "docker" -ArgumentList "compose", "-f", $COMPOSE_FILE, "up", "-d" -NoNewWindow -Wait -PassThru
    
    if ($upProcess.ExitCode -eq 0) {
        Print-Success "Containers started successfully"
    } else {
        Print-Error "Failed to start containers"
        exit 1
    }
} catch {
    Print-Error "Failed to start containers: $_"
    exit 1
}

Print-Step "Waiting for Containers to be Ready"
Start-Sleep -Seconds 5

Print-Step "Container Status"
docker compose -f $COMPOSE_FILE ps

$psOutput = docker compose -f $COMPOSE_FILE ps --format json 2>$null
if ($psOutput) {
    $runningCount = ($psOutput | ConvertFrom-Json | Where-Object { $_.State -eq "running" } | Measure-Object).Count
    $totalCount = ($psOutput | ConvertFrom-Json | Measure-Object).Count
} else {
    $runningCount = 0
    $totalCount = 0
}

if ($runningCount -eq $totalCount -and $totalCount -gt 0) {
    Print-Success "All $totalCount containers are running"
} else {
    Print-Error "Only $runningCount/$totalCount containers are running"
    Print-Info "Check logs for errors"
}

if ($APP_MODE -eq "production") {
    Print-Step "Verifying Frontend Deployment"
    Print-Info "Checking deployed files..."
    Start-Sleep -Seconds 3
    
    Print-Info "Files in volume:"
    try {
        docker exec caddy ls -lah /srv/frontend/assets/ 2>$null
    } catch {
        Print-Info "Files still being copied..."
    }
    
    Print-Info "Files on host:"
    Get-ChildItem ./frontend/dist/assets/index-*.js -ErrorAction SilentlyContinue | ForEach-Object {
        Print-Info "  $($_.Name)"
    }
    
    Print-Info "Frontend container logs:"
    try {
        $logs = docker logs frontend 2>$null | Select-Object -Last 10
        $logs | ForEach-Object { Write-Host $_ }
    } catch {
        Print-Info "No logs yet"
    }
}

Print-Step "Deployment Summary"
Write-ColorOutput Green "Deployment completed successfully!"
Write-ColorOutput Cyan "CACHEBUST: $CACHEBUST"
Write-ColorOutput Cyan "APP_MODE: $APP_MODE"
Write-ColorOutput Cyan "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""
Write-ColorOutput Yellow "View logs: docker compose -f $COMPOSE_FILE logs -f"
Write-ColorOutput Yellow "Check status: docker compose -f $COMPOSE_FILE ps"
Write-ColorOutput Yellow "Stop: docker compose -f $COMPOSE_FILE down"
Write-Host ""