Set-Location -Path $PSScriptRoot
$ErrorActionPreference = "Continue"
$global:HasErrors = $false
$global:ErrorLog = @()

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Host $args
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

function Install-Cloudflared {
    Print-Step "Installing Cloudflared"
    
    $cloudflaredPath = "C:\Program Files\cloudflared\cloudflared.exe"
    
    if (Test-Path $cloudflaredPath) {
        Print-Success "cloudflared already installed at $cloudflaredPath"
        return $cloudflaredPath
    }
    
    Print-Info "Downloading cloudflared..."
    
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    $installerPath = "$env:TEMP\cloudflared.exe"
    $installDir = "C:\Program Files\cloudflared"
    
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -ErrorAction Stop
        Print-Success "Downloaded cloudflared"
        
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        }
        
        Move-Item -Path $installerPath -Destination $cloudflaredPath -Force
        Print-Success "Installed to $cloudflaredPath"
        
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($currentPath -notlike "*$installDir*") {
            try {
                [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "Machine")
                $env:Path = "$env:Path;$installDir"
                Print-Success "Added to system PATH"
            } catch {
                Print-Warning "Could not add to system PATH: $_"
                Print-Info "You may need to run as Administrator"
            }
        }
        
        return $cloudflaredPath
        
    } catch {
        Print-Error "Failed to install cloudflared: $_"
        Print-Info "Please install manually from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        return $null
    }
}

function Authenticate-Cloudflare {
    param($cloudflaredPath)
    
    Print-Step "Authenticating with Cloudflare"
    
    $credentialsPath = "$env:USERPROFILE\.cloudflared\cert.pem"
    
    if (Test-Path $credentialsPath) {
        Print-Success "Cloudflare credentials found"
        return $true
    }
    
    Print-Warning "Cloudflare authentication required"
    Print-Info "A browser window will open for authentication..."
    Print-Info "Please login and authorize the connection"
    
    try {
        & $cloudflaredPath tunnel login
        
        if ($LASTEXITCODE -eq 0) {
            Start-Sleep -Seconds 2
            if (Test-Path $credentialsPath) {
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

function Get-OrCreate-Tunnel {
    param(
        $cloudflaredPath,
        [string]$TunnelName = "management-app-tunnel"
    )
    
    Print-Step "Setting up Tunnel '$TunnelName'"
    
    try {
        $tunnelsJson = & $cloudflaredPath tunnel list --output json 2>$null
        
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
        & $cloudflaredPath tunnel create $TunnelName 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Print-Warning "Tunnel creation returned non-zero exit code"
        }
        
        Start-Sleep -Seconds 2
        $tunnelsJson = & $cloudflaredPath tunnel list --output json 2>$null
        
        if ($tunnelsJson) {
            $tunnels = $tunnelsJson | ConvertFrom-Json
            $newTunnel = $tunnels | Where-Object { $_.name -eq $TunnelName }
            
            if ($newTunnel) {
                Print-Success "Tunnel created successfully"
                Print-Info "Tunnel ID: $($newTunnel.id)"
                return $newTunnel.id
            }
        }
        
        Print-Error "Could not retrieve tunnel ID after creation"
        return $null
        
    } catch {
        Print-Error "Tunnel setup error: $_"
        return $null
    }
}

function Create-TunnelConfig {
    param(
        [string]$TunnelId,
        [string]$Domain
    )
    
    Print-Step "Creating Tunnel Configuration"
    
    $configDir = "$env:USERPROFILE\.cloudflared"
    
    try {
        if (-not (Test-Path $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }
        
        $configContent = @"
tunnel: $TunnelId
credentials-file: $configDir\$TunnelId.json

ingress:
  - hostname: $Domain
    service: http://localhost:80
  - service: http_status:404
"@
        
        $configPath = "$configDir\config.yml"
        $configContent | Out-File -FilePath $configPath -Encoding UTF8 -Force
        
        Print-Success "Configuration created at $configPath"
        return $configPath
        
    } catch {
        Print-Error "Failed to create config: $_"
        return $null
    }
}

function Configure-DNS {
    param(
        $cloudflaredPath,
        [string]$TunnelName,
        [string]$Domain
    )
    
    Print-Step "Configuring DNS for $Domain"
    
    try {
        $output = & $cloudflaredPath tunnel route dns $TunnelName $Domain 2>&1
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

function Start-CloudflareTunnel {
    param(
        $cloudflaredPath,
        [string]$ConfigPath
    )
    
    Print-Step "Starting Cloudflare Tunnel"
    
    $existingProcesses = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($existingProcesses) {
        Print-Info "Stopping $($existingProcesses.Count) existing tunnel process(es)..."
        $existingProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }
    
    $oldJobs = Get-Job -Name "CloudflareTunnel*" -ErrorAction SilentlyContinue
    if ($oldJobs) {
        Print-Info "Cleaning up old tunnel jobs..."
        $oldJobs | Stop-Job -ErrorAction SilentlyContinue
        $oldJobs | Remove-Job -Force -ErrorAction SilentlyContinue
    }
    
    Print-Info "Starting tunnel in background..."
    
    try {
        $job = Start-Job -Name "CloudflareTunnel-$(Get-Date -Format 'yyyyMMdd-HHmmss')" -ScriptBlock {
            param($exe, $config)
            & $exe tunnel --config $config run 2>&1
        } -ArgumentList $cloudflaredPath, $ConfigPath
        
        Start-Sleep -Seconds 5
        
        $jobState = Get-Job -Id $job.Id | Select-Object -ExpandProperty State
        
        if ($jobState -eq "Running") {
            Print-Success "Tunnel is running (Job ID: $($job.Id), Name: $($job.Name))"
            Print-Info "Access your app at: https://$env:DOMAIN"
            
            $output = Receive-Job -Id $job.Id -ErrorAction SilentlyContinue
            if ($output) {
                Print-Info "Tunnel output:"
                $output | Select-Object -First 10 | ForEach-Object { 
                    Write-Host "  $_" -ForegroundColor Gray 
                }
            }
            
            return $job.Id
        } else {
            Print-Error "Tunnel failed to start"
            $output = Receive-Job -Id $job.Id -ErrorAction SilentlyContinue
            if ($output) {
                Print-Info "Job output:"
                $output | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
            return $null
        }
        
    } catch {
        Print-Error "Failed to start tunnel: $_"
        return $null
    }
}

function Setup-CloudflareTunnel {
    Print-Step "Cloudflare Tunnel Setup"
    
    $cloudflaredPath = Install-Cloudflared
    if (-not $cloudflaredPath) {
        Print-Error "Cannot proceed without cloudflared"
        return $null
    }
    
    $authenticated = Authenticate-Cloudflare $cloudflaredPath
    if (-not $authenticated) {
        Print-Error "Cannot proceed without authentication"
        return $null
    }
    
    $tunnelId = Get-OrCreate-Tunnel -cloudflaredPath $cloudflaredPath
    if (-not $tunnelId) {
        Print-Error "Cannot proceed without tunnel"
        return $null
    }
    
    $configPath = Create-TunnelConfig -TunnelId $tunnelId -Domain $env:DOMAIN
    if (-not $configPath) {
        Print-Error "Cannot proceed without config"
        return $null
    }
    
    Configure-DNS -cloudflaredPath $cloudflaredPath -TunnelName "management-app-tunnel" -Domain $env:DOMAIN
    
    return @{
        Path = $cloudflaredPath
        ConfigPath = $configPath
        TunnelId = $tunnelId
    }
}

function Build-Frontend {
    if ($script:APP_MODE -ne "production") {
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
        docker builder prune -a -f 2>&1 | Out-Null
        Print-Success "Build cache cleaned"
        
        docker compose -f $script:COMPOSE_FILE down 2>&1 | Out-Null
        Print-Success "$script:APP_MODE containers stopped"
        
        docker compose -f $script:OTHER_COMPOSE_FILE down 2>&1 | Out-Null
        Print-Success "Other environment stopped"
        
        if ($script:APP_MODE -eq "production") {
            docker volume rm managementapplication_frontend_dist -f 2>&1 | Out-Null
            Print-Info "Frontend volume removed"
        }
        
        $oldImages = docker images --format "{{.ID}} {{.Repository}}" | 
            Select-String "managementapplication"
        
        if ($oldImages) {
            Print-Info "Removing $($oldImages.Count) old image(s)..."
            $oldImages | ForEach-Object {
                $imageId = ($_ -split ' ')[0]
                docker rmi -f $imageId 2>&1 | Out-Null
            }
            Print-Success "Old images removed"
        }
        
        docker image prune -f 2>&1 | Out-Null
        docker container prune -f 2>&1 | Out-Null
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
    Print-Step "Starting Docker Containers"
    
    try {
        $upArgs = @(
            "compose",
            "-f", $script:COMPOSE_FILE,
            "up", "-d"
        )
        
        $upProcess = Start-Process -FilePath "docker" -ArgumentList $upArgs -NoNewWindow -Wait -PassThru
        
        if ($upProcess.ExitCode -eq 0) {
            Print-Success "Containers started"
            
            Print-Info "Waiting for containers to stabilize..."
            Start-Sleep -Seconds 5
            
            Print-Info "Container status:"
            docker compose -f $script:COMPOSE_FILE ps
            
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

function Start-Deployment {
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
        Print-Warning "Cloudflare Tunnel setup incomplete, but continuing with Docker deployment..."
    }
    
    $frontendBuilt = Build-Frontend
    if (-not $frontendBuilt -and $script:APP_MODE -eq "production") {
        Print-Warning "Frontend build failed, but continuing..."
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
        $tunnelJobId = Start-CloudflareTunnel -cloudflaredPath $tunnelInfo.Path -ConfigPath $tunnelInfo.ConfigPath
        if (-not $tunnelJobId) {
            Print-Warning "Tunnel failed to start, but application is still accessible locally"
        }
    }
    
    Show-DeploymentSummary
}

function Show-DeploymentSummary {    
    Write-ColorOutput Cyan "Deployment Information:"
    Write-Host "   CACHEBUST: $script:CACHEBUST"
    Write-Host "   APP_MODE: $script:APP_MODE"
    Write-Host "   DOMAIN: $env:DOMAIN"
    Write-Host "   Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host ""
    
    Write-ColorOutput Green "Access Your Application:"
    Write-ColorOutput Blue "   https://$env:DOMAIN"
    Write-ColorOutput Cyan "   http://localhost (if tunnel fails)"
    Write-Host ""
    
    Write-ColorOutput Yellow "Useful Commands:"
    Write-Host ""
    Write-Host "   View App Logs:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE logs -f" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   View Tunnel Logs:" -ForegroundColor White
    Write-Host "   Get-Job | Receive-Job" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Check Status:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE ps" -ForegroundColor Gray
    Write-Host "   Get-Job" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Stop Everything:" -ForegroundColor White
    Write-Host "   docker compose -f $script:COMPOSE_FILE down" -ForegroundColor Gray
    Write-Host "   Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Gray
    Write-Host ""
    
    if ($global:HasErrors) {
        Show-ErrorSummary
    } else {
        Write-ColorOutput Green "No errors detected during deployment"
    }
    
    Write-Host ""
    Write-ColorOutput Yellow "IMPORTANT: Keep this PowerShell window open to maintain the tunnel!"
    Write-Host ""
    Write-ColorOutput Cyan "Press Ctrl+C to stop the tunnel and exit"
    Write-Host ""
}


try {
    Start-Deployment
} catch {
    Print-Error "Unexpected error in deployment: $_"
    Show-ErrorSummary
    exit 1
} finally {
    $tunnelJobs = Get-Job -Name "CloudflareTunnel*" -ErrorAction SilentlyContinue
    if ($tunnelJobs) {
        Print-Info "Tunnel is running. Waiting... (Press Ctrl+C to exit)"
        try {
            while ($true) {
                Start-Sleep -Seconds 60
                
                $runningJobs = Get-Job -Name "CloudflareTunnel*" -State Running -ErrorAction SilentlyContinue
                if (-not $runningJobs) {
                    Print-Warning "Tunnel job ended unexpectedly"
                    break
                }
            }
        } catch {
            Print-Info "Exiting..."
        }
    }
}