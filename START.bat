@echo off
title Smart Resort 360 - Demo Startup
color 0B
echo.
echo  ========================================
echo   Smart Resort 360 - Demo Startup
echo   AI-Powered Resort Intelligence
echo  ========================================
echo.

:: ── Backend ──────────────────────────────────────────────
echo [1/3] Starting backend API on port 8000...
cd /d "%~dp0backend"

if not exist .venv (
    echo       Creating Python virtual environment...
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt -q
)

start "SR360-Backend" cmd /c "cd /d "%~dp0backend" && .\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
echo       Backend started!

:: ── Guest App ────────────────────────────────────────────
echo [2/3] Starting guest app on port 5173...
cd /d "%~dp0apps\guest-web"
if not exist node_modules (
    echo       Installing guest app dependencies...
    call npm install --silent
)
start "SR360-Guest" cmd /c "cd /d "%~dp0apps\guest-web" && npm run dev -- --port 5173 --host 127.0.0.1"
timeout /t 2 /nobreak >nul
echo       Guest app started!

:: ── Staff Dashboard ──────────────────────────────────────
echo [3/3] Starting staff dashboard on port 5174...
cd /d "%~dp0apps\staff-dashboard"
if not exist node_modules (
    echo       Installing staff dashboard dependencies...
    call npm install --silent
)
start "SR360-Staff" cmd /c "cd /d "%~dp0apps\staff-dashboard" && npm run dev -- --port 5174 --host 127.0.0.1"
timeout /t 2 /nobreak >nul
echo       Staff dashboard started!

echo.
echo  ========================================
echo   Smart Resort 360 is running!
echo.
echo   Guest App     http://localhost:5173
echo   Staff Dash    http://localhost:5174
echo   API Docs      http://localhost:8000/docs
echo.
echo   Demo Accounts:
echo     Guest:   guest@smartresort360.demo / DemoGuest!2026
echo     Staff:   suresh@smartresort360.demo / DemoStaff!2026
echo     Manager: manager@smartresort360.demo / DemoManager!2026
echo.
echo   Close this window to stop all services.
echo  ========================================
echo.

:: Keep window open - pressing any key closes all services
pause >nul
echo.
echo Shutting down services...
taskkill /FI "WINDOWTITLE eq SR360-Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SR360-Guest*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SR360-Staff*" /F >nul 2>&1
echo All services stopped.
