@echo off

echo.
echo ========================================
echo   Management Application Deployment
echo ========================================
echo.

where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is not installed or not in PATH
    pause
    exit /b 1
)

docker ps >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

powershell.exe -ExecutionPolicy Bypass -File "%~dp0run.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Deployment Completed Successfully!
echo ========================================
echo.
pause