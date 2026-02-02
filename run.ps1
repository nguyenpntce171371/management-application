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

function Print-Warning($message) {
    Write-ColorOutput Yellow "$message"
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

function Check-EnvVars {
    Print-Step "Checking Environment Variables"
    
    if (-not $env:DOMAIN) {
        Print-Error "DOMAIN is not set in .env file"
        Print-Info "Please add: DOMAIN=your-domain.com"
        exit 1
    }
    
    Print-Success "DOMAIN: $env:DOMAIN"
}

function Setup-CloudflareTunnel {
    Print-Step "Setting up Cloudflare Tunnel"
    
    $cloudflaredPath = "C:\Program Files\cloudflared\cloudflared.exe"
    
    if (-not (Test-Path $cloudflaredPath)) {
        Print-Info "Installing cloudflared..."
        
        $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        $installerPath = "$env:TEMP\cloudflared.exe"
        
        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath
            
            $installDir = "C:\Program Files\cloudflared"
            if (-not (Test-Path $installDir)) {
                New-Item -ItemType Directory -Path $installDir -Force | Out-Null
            }
            
            Move-Item -Path $installerPath -Destination $cloudflaredPath -Force
            
            $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if ($currentPath -notlike "*$installDir*") {
                [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "Machine")
                $env:Path = "$env:Path;$installDir"
            }
            
            Print-Success "cloudflared installed"
        } catch {
            Print-Error "Failed to install cloudflared: $_"
            exit 1
        }
    } else {
        Print-Info "cloudflared already installed"
    }
    
    $cloudflared = $cloudflaredPath
    
    $credentialsPath = "$env:USERPROFILE\.cloudflared\cert.pem"
    
    if (-not (Test-Path $credentialsPath)) {
        Print-Warning "Cloudflare authentication required"
        Print-Info "Please login to Cloudflare (browser will open)..."
        
        & $cloudflared tunnel login
        
        if ($LASTEXITCODE -ne 0) {
            Print-Error "Cloudflare authentication failed"
            exit 1
        }
        
        Print-Success "Cloudflare authentication completed"
    } else {
        Print-Info "Cloudflare credentials already exist"
    }
    
    $TUNNEL_NAME = "management-app-tunnel"
    
    $tunnelInfo = & $cloudflared tunnel info $TUNNEL_NAME 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Print-Info "Creating tunnel '$TUNNEL_NAME'..."
        & $cloudflared tunnel create $TUNNEL_NAME
        
        if ($LASTEXITCODE -ne 0) {
            Print-Error "Failed to create tunnel"
            exit 1
        }
        
        Print-Success "Tunnel created"
    } else {
        Print-Info "Tunnel '$TUNNEL_NAME' already exists"
    }
    
    $tunnelInfoJson = & $cloudflared tunnel info $TUNNEL_NAME -o json 2>&1
    $TUNNEL_ID = ($tunnelInfoJson | ConvertFrom-Json).id
    
    if (-not $TUNNEL_ID) {
        Print-Error "Failed to get tunnel ID"
        exit 1
    }
    
    Print-Success "Tunnel ID: $TUNNEL_ID"
    
    $configDir = "$env:USERPROFILE\.cloudflared"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $configContent = @"
tunnel: $TUNNEL_ID
credentials-file: $configDir\$TUNNEL_ID.json

ingress:
  - hostname: $env:DOMAIN
    service: http://localhost:80
  - service: http_status:404
"@
    
    $configContent | Out-File -FilePath "$configDir\config.yml" -Encoding UTF8
    Print-Success "Tunnel config created"
    
    Print-Info "Configuring DNS routing..."
    & $cloudflared tunnel route dns $TUNNEL_NAME $env:DOMAIN 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Print-Success "DNS configured for $env:DOMAIN"
    } else {
        Print-Warning "DNS routing might already exist or failed"
        Print-Info "Please verify DNS settings in Cloudflare Dashboard"
    }
    
    return $cloudflared
}

function Start-CloudflareTunnel {
    param($cloudflaredPath)
    
    Print-Step "Starting Cloudflare Tunnel"
    
    $existingProcess = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($existingProcess) {
        Print-Info "Stopping existing tunnel process..."
        $existingProcess | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
    
    $configPath = "$env:USERPROFILE\.cloudflared\config.yml"
    
    Print-Info "Starting tunnel in background..."
    
    $job = Start-Job -ScriptBlock {
        param($exe, $config)
        & $exe tunnel --config $config run
    } -ArgumentList $cloudflaredPath, $configPath
    
    Start-Sleep -Seconds 5
    
    $jobState = Get-Job -Id $job.Id | Select-Object -ExpandProperty State
    
    if ($jobState -eq "Running") {
        Print-Success "Cloudflare Tunnel is running (Job ID: $($job.Id))"
        Print-Info "Your app is accessible at: https://$env:DOMAIN"
        Print-Warning "Tunnel is running as PowerShell job - keep this window open"
        Print-Info "To stop tunnel: Stop-Job -Id $($job.Id); Remove-Job -Id $($job.Id)"
    } else {
        Print-Error "Failed to start Cloudflare Tunnel"
        Print-Info "Check job output: Receive-Job -Id $($job.Id)"
        exit 1
    }
}

Print-Step "Starting Deployment with Cloudflare Tunnel"
Print-Info "CACHEBUST: $CACHEBUST"
Print-Info "APP_MODE: $APP_MODE"
Print-Info "DOMAIN: $env:DOMAIN"
Print-Info "Compose file: $COMPOSE_FILE"
Print-Info "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

Check-EnvVars

$cloudflaredExe = Setup-CloudflareTunnel

if ($APP_MODE -eq "production") {
    Print-Step "Building Frontend for Production"
    Push-Location ./frontend
    
    try {
        Print-Info "Cleaning ALL caches and old build..."
        if (Test-Path dist) { Remove-Item -Recurse -Force dist }
        if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
        if (Test-Path .vite) { Remove-Item -Recurse -Force .vite }
        
        Print-Info "Installing fresh dependencies..."
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
        
        Print-Info "Building production bundle..."
        $npmBuild = Start-Process -FilePath "npm" -ArgumentList "run", "build" -NoNewWindow -Wait -PassThru
        
        if ($npmBuild.ExitCode -eq 0) {
            Print-Success "Frontend build completed!"
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
docker builder prune -a -f
Print-Success "Docker build cache cleaned"

Print-Step "Stopping All Containers"
try {
    docker compose -f $COMPOSE_FILE down 2>&1 | Out-Null
    Print-Success "$APP_MODE containers stopped"
} catch {
    Print-Info "No containers running"
}

try {
    docker compose -f $OTHER_COMPOSE_FILE down 2>&1 | Out-Null
    Print-Success "Other environment containers stopped"
} catch {
    Print-Info "No other containers running"
}

if ($APP_MODE -eq "production") {
    Print-Step "Cleaning Frontend Volume"
    try {
        docker volume rm managementapplication_frontend_dist 2>&1 | Out-Null
        Print-Success "Frontend volume removed"
    } catch {
        Print-Info "Volume already removed"
    }
}

Print-Step "Removing Old Project Images"
$oldImages = docker images | Select-String "managementapplication"
if ($oldImages) {
    $imageCount = ($oldImages | Measure-Object).Count
    Print-Info "Found $imageCount old images"
    
    $oldImages | ForEach-Object {
        $imageId = ($_ -split '\s+')[2]
        docker rmi -f $imageId 2>&1 | Out-Null
    }
    Print-Success "Old images removed"
}

Print-Step "Building Images"
$env:CACHEBUST = $CACHEBUST
$buildProcess = Start-Process -FilePath "docker" -ArgumentList "compose", "-f", $COMPOSE_FILE, "build", "--build-arg", "APP_MODE=$APP_MODE" -NoNewWindow -Wait -PassThru

if ($buildProcess.ExitCode -eq 0) {
    Print-Success "Images built successfully"
} else {
    Print-Error "Build failed"
    exit 1
}

Print-Step "Cleaning Up Docker Resources"
docker image prune -f
docker container prune -f
docker network prune -f
Print-Success "Cleanup completed"

Print-Step "Starting Containers"
$upProcess = Start-Process -FilePath "docker" -ArgumentList "compose", "-f", $COMPOSE_FILE, "up", "-d" -NoNewWindow -Wait -PassThru

if ($upProcess.ExitCode -eq 0) {
    Print-Success "Containers started successfully"
} else {
    Print-Error "Failed to start containers"
    exit 1
}

Print-Step "Waiting for Containers to be Ready"
Start-Sleep -Seconds 5

Print-Step "Container Status"
docker compose -f $COMPOSE_FILE ps

Start-CloudflareTunnel $cloudflaredExe

Print-Step "Deployment Summary"
Write-ColorOutput Green "Deployment completed successfully!"
Write-Host ""
Write-ColorOutput Cyan "CACHEBUST: $CACHEBUST"
Write-ColorOutput Cyan "APP_MODE: $APP_MODE"
Write-ColorOutput Cyan "DOMAIN: $env:DOMAIN"
Write-ColorOutput Cyan "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""
Write-ColorOutput Green "Your application is now accessible at:"
Write-ColorOutput Blue "   https://$env:DOMAIN"
Write-Host ""
Write-ColorOutput Yellow "View logs:"
Write-Host "   App: docker compose -f $COMPOSE_FILE logs -f"
Write-Host "   Tunnel: Get-Job | Receive-Job"
Write-Host ""
Write-ColorOutput Yellow "Check status:"
Write-Host "   App: docker compose -f $COMPOSE_FILE ps"
Write-Host "   Tunnel: Get-Job"
Write-Host ""
Write-ColorOutput Yellow "Stop:"
Write-Host "   App: docker compose -f $COMPOSE_FILE down"
Write-Host "   Tunnel: Get-Job | Stop-Job; Get-Job | Remove-Job"
Write-Host ""
Write-ColorOutput Yellow "Keep this PowerShell window open to maintain the tunnel!"
Write-Host ""