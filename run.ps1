Set-Location -Path $PSScriptRoot
$ErrorActionPreference = "Continue"
$global:HasErrors = $false
$global:ErrorLog = @()

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
    $global:HasErrors = $true
    $global:ErrorLog += $message
}

function Print-Info($message) {
    Write-ColorOutput Cyan "$message"
}

function Print-Warning($message) {
    Write-ColorOutput Yellow "$message"
}

function Safe-Execute {
    param(
        [ScriptBlock]$ScriptBlock,
        [string]$ErrorMessage = "Operation failed",
        [switch]$CriticalError = $false
    )
    
    try {
        & $ScriptBlock
        return $true
    } catch {
        Print-Error "$ErrorMessage : $_"
        if ($CriticalError) {
            Print-Error "Critical error encountered. Stopping deployment."
            Show-ErrorSummary
            exit 1
        }
        return $false
    }
}

function Show-ErrorSummary {
    if ($global:HasErrors) {
        Write-Host ""
        Print-Warning "Deployment completed with errors:"
        $global:ErrorLog | ForEach-Object {
            Write-ColorOutput Red "  - $_"
        }
        Write-Host ""
    }
}

function Load-Environment {
    Print-Step "Loading Environment Configuration"
    
    if (Test-Path .env) {
        try {
            Get-Content .env | ForEach-Object {
                if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
                    $name = $matches[1].Trim()
                    $value = $matches[2].Trim()
                    [Environment]::SetEnvironmentVariable($name, $value, "Process")
                }
            }
            Print-Success ".env file loaded"
        } catch {
            Print-Warning "Failed to load .env file: $_"
        }
    } else {
        Print-Warning ".env file not found"
    }
}

function Initialize-Variables {
    $script:APP_MODE = if ($env:APP_MODE) { $env:APP_MODE } else { "development" }
    
    if ($script:APP_MODE -eq "production") {
        $script:COMPOSE_FILE = "docker-compose.production.yml"
        $script:OTHER_COMPOSE_FILE = "docker-compose.development.yml"
    } else {
        $script:COMPOSE_FILE = "docker-compose.development.yml"
        $script:OTHER_COMPOSE_FILE = "docker-compose.production.yml"
    }
    
    $script:CACHEBUST = [int](Get-Date -UFormat %s)
    $env:CACHEBUST = $script:CACHEBUST
    
    Print-Info "CACHEBUST: $script:CACHEBUST"
    Print-Info "APP_MODE: $script:APP_MODE"
    Print-Info "COMPOSE_FILE: $script:COMPOSE_FILE"
}

function Check-EnvVars {
    Print-Step "Validating Environment Variables"
    
    $required = @("DOMAIN")
    $missing = @()
    
    foreach ($var in $required) {
        $value = [Environment]::GetEnvironmentVariable($var, "Process")
        if (-not $value) {
            $missing += $var
        } else {
            Print-Success "${var}: $value"
        }
    }
    
    if ($missing.Count -gt 0) {
        Print-Error "Missing required variables: $($missing -join ', ')"
        Print-Info "Please add them to your .env file"
        return $false
    }
    
    return $true
}

function Test-DockerRunning {
    Print-Step "Checking Docker Status"
    
    try {
        $dockerVersion = docker version --format '{{.Server.Version}}' 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $dockerVersion) {
            Print-Success "Docker is running (version: $dockerVersion)"
            return $true
        } else {
            Print-Error "Docker is not running or not responding"
            Print-Info "Please start Docker Desktop and try again"
            return $false
        }
    } catch {
        Print-Error "Cannot connect to Docker: $_"
        return $false
    }
}

function Ensure-DockerNetwork {
    param (
        [string]$NetworkName = "web"
    )

    Print-Step "Ensuring Docker Network '$NetworkName'"

    try {
        $networkExists = docker network ls --format "{{.Name}}" 2>$null | 
            Where-Object { $_ -eq $NetworkName }

        if (-not $networkExists) {
            Print-Info "Creating docker network '$NetworkName'..."
            docker network create $NetworkName 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Print-Success "Docker network '$NetworkName' created"
            } else {
                Print-Warning "Failed to create network, it might already exist"
            }
        } else {
            Print-Success "Docker network '$NetworkName' exists"
        }
    } catch {
        Print-Warning "Network check failed: $_"
    }
}

function Setup-CloudflareDirectory {
    Print-Step "Setting up Cloudflare Configuration Directory"
    
    $cloudflaredDir = "$env:USERPROFILE\.cloudflared"
    
    try {
        if (-not (Test-Path $cloudflaredDir)) {
            New-Item -ItemType Directory -Path $cloudflaredDir -Force | Out-Null
            Print-Success "Created .cloudflared directory at: $cloudflaredDir"
        } else {
            Print-Success ".cloudflared directory exists at: $cloudflaredDir"
        }
        
        return $cloudflaredDir
    } catch {
        Print-Error "Failed to create .cloudflared directory: $_"
        return $null
    }
}

function Test-CloudflareCredentials {
    param([string]$CloudflaredDir)
    
    Print-Step "Checking Cloudflare Credentials"
    
    $certPath = "$CloudflaredDir\cert.pem"
    
    if (Test-Path $certPath) {
        Print-Success "Cloudflare credentials found"
        return $true
    } else {
        Print-Warning "Cloudflare credentials not found"
        return $false
    }
}

function Invoke-CloudflareLogin {
    param([string]$CloudflaredDir)
    
    Print-Step "Cloudflare Authentication Required"
    Print-Info "Starting temporary cloudflared container for login..."
    Print-Warning "A browser window will open - please login to Cloudflare"
    
    try {
        $loginCommand = @(
            "run", "--rm", "-it",
            "-v", "${CloudflaredDir}:/home/nonroot/.cloudflared",
            "cloudflare/cloudflared:latest",
            "tunnel", "login"
        )
        
        $process = Start-Process -FilePath "docker" -ArgumentList $loginCommand -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Start-Sleep -Seconds 2
            if (Test-Path "$CloudflaredDir\cert.pem") {
                Print-Success "Authentication successful"
                return $true
            }
        }
        
        Print-Error "Authentication failed or was cancelled"
        return $false
        
    } catch {
        Print-Error "Authentication error: $_"
        return $false
    }
}

function Get-OrCreateTunnel {
    param(
        [string]$CloudflaredDir,
        [string]$TunnelName = "management-app-tunnel"
    )
    
    Print-Step "Managing Cloudflare Tunnel '$TunnelName'"
    
    try {
        Print-Info "Checking for existing tunnels..."
        
        $listCommand = @(
            "run", "--rm",
            "-v", "${CloudflaredDir}:/home/nonroot/.cloudflared",
            "cloudflare/cloudflared:latest",
            "tunnel", "list", "--output", "json"
        )
        
        $tunnelsJson = docker $listCommand 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $tunnelsJson) {
            $tunnels = $tunnelsJson | ConvertFrom-Json
            $existingTunnel = $tunnels | Where-Object { $_.name -eq $TunnelName }
            
            if ($existingTunnel) {
                Print-Success "Found existing tunnel '$TunnelName'"
                Print-Info "Tunnel ID: $($existingTunnel.id)"
                return $existingTunnel.id
            }
        }
        
        Print-Info "Creating new tunnel '$TunnelName'..."
        
        $createCommand = @(
            "run", "--rm",
            "-v", "${CloudflaredDir}:/home/nonroot/.cloudflared",
            "cloudflare/cloudflared:latest",
            "tunnel", "create", $TunnelName
        )
        
        docker $createCommand 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Start-Sleep -Seconds 2
            
            $tunnelsJson = docker $listCommand 2>$null
            if ($tunnelsJson) {
                $tunnels = $tunnelsJson | ConvertFrom-Json
                $newTunnel = $tunnels | Where-Object { $_.name -eq $TunnelName }
                
                if ($newTunnel) {
                    Print-Success "Tunnel created successfully"
                    Print-Info "Tunnel ID: $($newTunnel.id)"
                    return $newTunnel.id
                }
            }
        }
        
        Print-Error "Could not retrieve tunnel ID after creation"
        return $null
        
    } catch {
        Print-Error "Tunnel management error: $_"
        return $null
    }
}

function Create-TunnelConfig {
    param(
        [string]$CloudflaredDir,
        [string]$TunnelId,
        [string]$Domain
    )
    
    Print-Step "Creating Tunnel Configuration"
    
    try {
        $configContent = @"
tunnel: $TunnelId
credentials-file: /home/nonroot/.cloudflared/$TunnelId.json

ingress:
  - hostname: $Domain
    service: http://bds-caddy:80
  - service: http_status:404
"@
        
        $configPath = "$CloudflaredDir\config.yml"
        $configContent | Out-File -FilePath $configPath -Encoding UTF8 -Force
        
        Print-Success "Configuration created at: $configPath"
        Print-Info "Tunnel will route to: bds-caddy:80 (Caddy container)"
        
        return $configPath
        
    } catch {
        Print-Error "Failed to create config: $_"
        return $null
    }
}

function Configure-TunnelDNS {
    param(
        [string]$CloudflaredDir,
        [string]$TunnelName,
        [string]$Domain
    )
    
    Print-Step "Configuring DNS for $Domain"
    
    try {
        $routeCommand = @(
            "run", "--rm",
            "-v", "${CloudflaredDir}:/home/nonroot/.cloudflared",
            "cloudflare/cloudflared:latest",
            "tunnel", "route", "dns", $TunnelName, $Domain
        )
        
        $output = docker $routeCommand 2>&1
        $outputString = $output | Out-String
        
        if ($outputString -match "already exists" -or 
            $outputString -match "already configured" -or 
            $outputString -match "Successfully" -or
            $LASTEXITCODE -eq 0) {
            Print-Success "DNS configured for $Domain"
            return $true
        } else {
            Print-Warning "DNS configuration unclear"
            Print-Info "Please verify in Cloudflare Dashboard: https://dash.cloudflare.com"
            return $false
        }
    } catch {
        Print-Warning "DNS configuration error: $_"
        Print-Info "You may need to configure DNS manually in Cloudflare Dashboard"
        return $false
    }
}

function Setup-CloudflareTunnel {
    Print-Step "Cloudflare Tunnel Setup (Docker Mode)"
    
    $cloudflaredDir = Setup-CloudflareDirectory
    if (-not $cloudflaredDir) {
        Print-Error "Cannot proceed without .cloudflared directory"
        return $null
    }
    
    $hasCredentials = Test-CloudflareCredentials -CloudflaredDir $cloudflaredDir
    if (-not $hasCredentials) {
        Print-Info "Cloudflare login required..."
        $loginSuccess = Invoke-CloudflareLogin -CloudflaredDir $cloudflaredDir
        
        if (-not $loginSuccess) {
            Print-Error "Cannot proceed without Cloudflare authentication"
            Print-Info "Please run this command manually to login:"
            Print-Info "docker run --rm -it -v `"${cloudflaredDir}:/home/nonroot/.cloudflared`" cloudflare/cloudflared:latest tunnel login"
            return $null
        }
    }
    
    $tunnelId = Get-OrCreateTunnel -CloudflaredDir $cloudflaredDir
    if (-not $tunnelId) {
        Print-Error "Cannot proceed without tunnel"
        return $null
    }
    
    $configPath = Create-TunnelConfig -CloudflaredDir $cloudflaredDir -TunnelId $tunnelId -Domain $env:DOMAIN
    if (-not $configPath) {
        Print-Error "Cannot proceed without config"
        return $null
    }
    
    Configure-TunnelDNS -CloudflaredDir $cloudflaredDir -TunnelName "management-app-tunnel" -Domain $env:DOMAIN
    
    Print-Success "Cloudflare Tunnel setup complete"
    Print-Info "Tunnel will be started via docker-compose with other services"
    
    return @{
        CloudflaredDir = $cloudflaredDir
        TunnelId = $tunnelId
        ConfigPath = $configPath
    }
}

function Build-Frontend {
    if ($script:APP_MODE -ne "production") {
        Print-Info "Development mode - skipping frontend build"
        return $true
    }
    
    Print-Step "Building Frontend for Production"
    
    if (-not (Test-Path "./frontend")) {
        Print-Warning "Frontend directory not found, skipping build"
        return $true
    }
    
    Push-Location ./frontend
    
    try {
        Print-Info "Cleaning caches and old builds..."
        @("dist", "node_modules", ".vite") | ForEach-Object {
            if (Test-Path $_) {
                Remove-Item -Recurse -Force $_ -ErrorAction SilentlyContinue
                Print-Info "Removed $_"
            }
        }
        
        Print-Info "Installing dependencies..."
        $env:APP_MODE = "development"
        $npmInstall = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -Wait -PassThru
        
        if ($npmInstall.ExitCode -ne 0) {
            Print-Error "npm install failed with code $($npmInstall.ExitCode)"
            Pop-Location
            return $false
        }
        Print-Success "Dependencies installed"
        
        Print-Info "Building production bundle..."
        $env:APP_MODE = "production"
        $npmBuild = Start-Process -FilePath "npm" -ArgumentList "run", "build" -NoNewWindow -Wait -PassThru
        
        if ($npmBuild.ExitCode -ne 0) {
            Print-Error "npm build failed with code $($npmBuild.ExitCode)"
            Pop-Location
            return $false
        }
        
        Print-Success "Frontend build completed"
        Pop-Location
        return $true
        
    } catch {
        Print-Error "Frontend build error: $_"
        Pop-Location
        return $false
    }
}

function Clean-Docker {
    Print-Step "Cleaning Docker Resources"
    
    try {
        Print-Info "Stopping all containers..."
        docker compose -f $script:COMPOSE_FILE down 2>&1 | Out-Null
        Print-Success "$script:APP_MODE containers stopped"
        
        docker compose -f $script:OTHER_COMPOSE_FILE down 2>&1 | Out-Null
        Print-Success "Other environment stopped"
        
        Print-Info "Cleaning build cache..."
        docker builder prune -a -f 2>&1 | Out-Null
        Print-Success "Build cache cleaned"
        
        if ($script:APP_MODE -eq "production") {
            docker volume rm managementapplication_frontend_dist -f 2>&1 | Out-Null
            Print-Info "Frontend volume removed"
        }
        
        Print-Info "Removing old project images..."
        $oldImages = docker images --format "{{.ID}} {{.Repository}}" | 
            Select-String "managementapplication"
        
        if ($oldImages) {
            Print-Info "Found $($oldImages.Count) old image(s) to remove..."
            $oldImages | ForEach-Object {
                $imageId = ($_ -split ' ')[0]
                docker rmi -f $imageId 2>&1 | Out-Null
            }
            Print-Success "Old images removed"
        }
        
        Print-Info "Running general cleanup..."
        docker image prune -f 2>&1 | Out-Null
        docker container prune -f 2>&1 | Out-Null
        docker network prune -f 2>&1 | Out-Null
        Print-Success "Docker cleanup completed"
        
        return $true
        
    } catch {
        Print-Warning "Docker cleanup error: $_"
        return $false
    }
}

function Build-DockerImages {
    Print-Step "Building Docker Images"
    
    $env:CACHEBUST = $script:CACHEBUST
    
    try {
        $buildArgs = @(
            "compose",
            "-f", $script:COMPOSE_FILE,
            "build",
            "--build-arg", "APP_MODE=$script:APP_MODE",
            "--build-arg", "CACHEBUST=$script:CACHEBUST"
        )
        
        Print-Info "Running docker build..."
        $buildProcess = Start-Process -FilePath "docker" -ArgumentList $buildArgs -NoNewWindow -Wait -PassThru
        
        if ($buildProcess.ExitCode -eq 0) {
            Print-Success "Images built successfully"
            return $true
        } else {
            Print-Error "Build failed with exit code $($buildProcess.ExitCode)"
            return $false
        }
        
    } catch {
        Print-Error "Build error: $_"
        return $false
    }
}

function Start-DockerContainers {
    Print-Step "Starting Docker Containers (including Cloudflare Tunnel)"
    
    try {
        $upArgs = @(
            "compose",
            "--profile", "tunnel",
            "-f", $script:COMPOSE_FILE,
            "up", "-d"
        )
        
        Print-Info "Starting all services..."
        $upProcess = Start-Process -FilePath "docker" -ArgumentList $upArgs -NoNewWindow -Wait -PassThru
        
        if ($upProcess.ExitCode -eq 0) {
            Print-Success "Containers started"
            
            Print-Info "Waiting for containers to stabilize..."
            Start-Sleep -Seconds 8
            
            Print-Info "Container status:"
            docker compose -f $script:COMPOSE_FILE ps
            
            Print-Info "Checking Cloudflare Tunnel status..."
            $cloudflaredStatus = docker ps --filter "name=cloudflared" --format "{{.Status}}" 2>$null
            
            if ($cloudflaredStatus -match "Up") {
                Print-Success "Cloudflare Tunnel container is running"
            } else {
                Print-Warning "Cloudflare Tunnel container status unclear"
                Print-Info "Check logs: docker logs cloudflared"
            }
            
            return $true
        } else {
            Print-Error "Failed to start containers (exit code: $($upProcess.ExitCode))"
            return $false
        }
        
    } catch {
        Print-Error "Start containers error: $_"
        return $false
    }
}

function Show-TunnelLogs {
    Print-Step "Cloudflare Tunnel Logs (Last 20 lines)"
    
    try {
        $logs = docker logs cloudflared --tail 20 2>&1
        if ($logs) {
            $logs | ForEach-Object { 
                Write-Host "  $_" -ForegroundColor Gray 
            }
        } else {
            Print-Info "No logs available yet"
        }
    } catch {
        Print-Warning "Could not retrieve tunnel logs: $_"
    }
}

function Start-Deployment {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║                                                            ║" -ForegroundColor Blue
    Write-Host "║              MANAGEMENT APPLICATION DEPLOYMENT             ║" -ForegroundColor Yellow
    Write-Host "║              with Dockerized Cloudflare Tunnel             ║" -ForegroundColor Yellow
    Write-Host "║                                                            ║" -ForegroundColor Blue
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
    
    Load-Environment
    Initialize-Variables
    
    if (-not (Check-EnvVars)) {
        Print-Error "Environment validation failed"
        exit 1
    }
    
    if (-not (Test-DockerRunning)) {
        Print-Error "Docker is required but not running"
        exit 1
    }
    
    Ensure-DockerNetwork "web"
    
    $tunnelInfo = Setup-CloudflareTunnel
    if (-not $tunnelInfo) {
        Print-Warning "Cloudflare Tunnel setup incomplete"
        Print-Warning "You can configure it later or access the app locally"
    }
    
    $frontendBuilt = Build-Frontend
    if (-not $frontendBuilt -and $script:APP_MODE -eq "production") {
        Print-Warning "Frontend build had issues, but continuing..."
    }
    
    Clean-Docker
    
    $imagesBuilt = Build-DockerImages
    if (-not $imagesBuilt) {
        Print-Error "Cannot proceed without Docker images"
        Show-ErrorSummary
        exit 1
    }
    
    $containersStarted = Start-DockerContainers
    if (-not $containersStarted) {
        Print-Error "Failed to start containers"
        Show-ErrorSummary
        exit 1
    }
    
    if ($tunnelInfo) {
        Start-Sleep -Seconds 3
        Show-TunnelLogs
    }
    
    Show-DeploymentSummary
}

function Show-DeploymentSummary {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "║                DEPLOYMENT COMPLETED                        ║" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    Write-ColorOutput Cyan "Deployment Information:"
    Write-Host "   CACHEBUST: $script:CACHEBUST"
    Write-Host "   APP_MODE: $script:APP_MODE"
    Write-Host "   DOMAIN: $env:DOMAIN"
    Write-Host "   Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host ""
    
    Write-ColorOutput Green "Access Your Application:"
    Write-ColorOutput Blue "   https://$env:DOMAIN (via Cloudflare Tunnel)"
    Write-ColorOutput Cyan "   http://localhost (local access)"
    Write-Host ""
    
    Write-ColorOutput Yellow "📋 Useful Commands:"
    Write-Host ""
    Write-Host "   View All Logs:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE logs -f" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   View Specific Service Logs:" -ForegroundColor White
    Write-Host "   docker logs cloudflared -f    # Tunnel logs" -ForegroundColor Gray
    Write-Host "   docker logs bds-caddy -f      # Caddy logs" -ForegroundColor Gray
    Write-Host "   docker logs backend -f        # Backend logs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Check Container Status:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE ps" -ForegroundColor Gray
    Write-Host "   docker ps" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Restart Specific Service:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE restart cloudflared" -ForegroundColor Gray
    Write-Host "   docker compose -f $script:COMPOSE_FILE restart bds-caddy" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Stop All Services:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE down" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Stop and Remove Volumes:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE down -v" -ForegroundColor Gray
    Write-Host ""
    
    Write-ColorOutput Cyan "🔧 Troubleshooting:"
    Write-Host ""
    Write-Host "   If tunnel is not working:" -ForegroundColor White
    Write-Host "   1. Check tunnel logs: docker logs cloudflared" -ForegroundColor Gray
    Write-Host "   2. Verify Caddy is running: docker ps | findstr bds-caddy" -ForegroundColor Gray
    Write-Host "   3. Check network: docker network inspect web" -ForegroundColor Gray
    Write-Host "   4. Restart tunnel: docker compose -f $script:COMPOSE_FILE restart cloudflared" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   If website shows error:" -ForegroundColor White
    Write-Host "   1. Check backend: docker logs backend" -ForegroundColor Gray
    Write-Host "   2. Check Caddy config: docker exec bds-caddy cat /etc/caddy/Caddyfile" -ForegroundColor Gray
    Write-Host "   3. Test backend directly: curl http://localhost:5000/api/health" -ForegroundColor Gray
    Write-Host ""
    
    if ($global:HasErrors) {
        Show-ErrorSummary
    } else {
        Write-ColorOutput Green "No errors detected during deployment"
    }
    
    Write-Host ""
    Write-ColorOutput Green "Your application is now running!"
    Write-ColorOutput Cyan "   All services (including Cloudflare Tunnel) are running in Docker"
    Write-ColorOutput Cyan "   No need to keep this window open - everything runs in background"
    Write-Host ""
}

try {
    Start-Deployment
} catch {
    Print-Error "Unexpected error in deployment: $_"
    Show-ErrorSummary
    exit 1
}