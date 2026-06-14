@echo off
title Pixel Beads Generator

cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found, please install Python 3.8+
    pause
    exit /b 1
)

echo [1/2] Checking dependencies...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo [2/2] Installing dependencies...
    pip install -r requirements.txt
) else (
    echo [2/2] Dependencies ready
)

echo.
echo ========================================
echo   Pixel Beads Generator
echo   Open browser: http://localhost:5000
echo   Press Ctrl+C to stop
echo ========================================
echo.

start http://localhost:5000
python app.py

pause
