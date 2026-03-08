# WSL Diagnostic and Repair Script
# Run as Administrator in PowerShell
# Usage: .\scripts\repair-wsl.ps1

Param(
    [switch]$Force  # Force destructive repairs without backup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Write-Status($msg) {
    Write-Host "▶ $msg" -ForegroundColor Cyan
}

function Write-Error-Custom($msg) {
    Write-Host "✗ $msg" -ForegroundColor Red
}

function Write-Success($msg) {
    Write-Host "✓ $msg" -ForegroundColor Green
}

function Test-Admin {
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check admin
if (-not (Test-Admin)) {
    Write-Error-Custom "ERROR: Run this script as Administrator"
    exit 1
}

Write-Status "=== WSL Diagnostic & Repair ==="
Write-Status ""

# 1. Check LxssManager service
Write-Status "1. Checking LxssManager service..."
try {
    $svc = Get-Service LxssManager -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Success "LxssManager found (Status: $($svc.Status))"
        if ($svc.Status -ne "Running") {
            Write-Status "  Starting LxssManager..."
            Start-Service LxssManager -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            $svc = Get-Service LxssManager
            Write-Success "  LxssManager now: $($svc.Status)"
        }
    } else {
        Write-Error-Custom "LxssManager service not found"
    }
} catch {
    Write-Error-Custom "Error checking service: $_"
}

Write-Status ""

# 2. Check installed distros
Write-Status "2. Checking installed distros..."
try {
    $distros = wsl -l -v 2>&1
    if ($distros -and $distros[0] -notlike "*Unknown*") {
        Write-Success "Distros found:"
        $distros | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Error-Custom "No distros found or wsl command failed: $distros"
    }
} catch {
    Write-Error-Custom "Error listing distros: $_"
}

Write-Status ""

# 3. Try to connect to Ubuntu
Write-Status "3. Testing Ubuntu connection..."
try {
    $result = wsl -d Ubuntu -e echo "WSL works" 2>&1
    if ($result -like "*WSL works*") {
        Write-Success "Ubuntu is accessible"
    } else {
        Write-Error-Custom "Ubuntu connection failed: $result"
    }
} catch {
    Write-Error-Custom "Error connecting to Ubuntu: $_"
}

Write-Status ""

# 4. Shutdown and restart WSL
Write-Status "4. Restarting WSL services..."
try {
    Write-Status "  Shutting down WSL..."
    wsl --shutdown 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    
    Write-Status "  Restarting LxssManager..."
    Restart-Service LxssManager -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    
    Write-Success "WSL restarted"
} catch {
    Write-Error-Custom "Error restarting WSL: $_"
}

Write-Status ""

# 5. Test again
Write-Status "5. Testing after restart..."
try {
    $result = wsl -d Ubuntu -e echo "Test" 2>&1
    if ($result -like "*Test*") {
        Write-Success "Ubuntu is now working!"
        exit 0
    } else {
        Write-Error-Custom "Ubuntu still not responding: $result"
    }
} catch {
    Write-Error-Custom "Error testing: $_"
}

Write-Status ""

# 6. If still failing, suggest nuclear option
Write-Status "6. If above didn't work:"
Write-Host ""
Write-Host "Option A: Backup and re-register distro (safer)"
Write-Host "  1. Export: wsl --export Ubuntu C:\Users\$env:USERNAME\ubuntu-backup.tar"
Write-Host "  2. Unregister: wsl --unregister Ubuntu"
Write-Host "  3. Reinstall from Microsoft Store or re-import"
Write-Host ""
Write-Host "Option B: Update WSL"
Write-Host "  Run: wsl --update"
Write-Host "  Then: wsl --shutdown"
Write-Host ""
Write-Host "Option C: Check Windows Update for WSL/Hyper-V updates"
Write-Host ""

if ($Force) {
    Write-Status ""
    Write-Status "Force mode: Attempting backup and unregister..."
    
    try {
        $backupPath = "C:\Users\$env:USERNAME\ubuntu-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar"
        Write-Status "Exporting Ubuntu to: $backupPath"
        wsl --export Ubuntu $backupPath
        if (Test-Path $backupPath) {
            Write-Success "Backup created successfully"
            
            Write-Status "Unregistering Ubuntu..."
            wsl --unregister Ubuntu
            Write-Success "Ubuntu unregistered. Reinstall from Microsoft Store."
        } else {
            Write-Error-Custom "Backup failed"
        }
    } catch {
        Write-Error-Custom "Force repair failed: $_"
    }
}

Write-Status ""
Write-Status "=== Done ==="
