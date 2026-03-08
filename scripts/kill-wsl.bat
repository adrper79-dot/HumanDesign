@echo off
REM Kill all zombie WSL processes and restart WSL
REM Run as Administrator

echo === Killing all WSL processes ===
wsl --shutdown
taskkill /IM wsl.exe /F 2>nul
taskkill /IM ubuntu.exe /F 2>nul
taskkill /IM bash.exe /F 2>nul

echo Waiting 3 seconds...
timeout /t 3 /nobreak

echo === Restarting LxssManager service ===
net stop LxssManager 2>nul
timeout /t 2 /nobreak
net start LxssManager 2>nul

echo Waiting 3 seconds...
timeout /t 3 /nobreak

echo === Testing WSL ===
wsl -d Ubuntu -e echo "WSL is working"

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: WSL is fixed
) else (
    echo FAILED: WSL still has issues
    echo Run repair-wsl.ps1 in PowerShell for detailed diagnostics
)

pause
