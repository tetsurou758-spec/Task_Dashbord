@echo off
cd /d "%~dp0"

echo [1] 既存のPythonプロセスを終了...
taskkill /F /IM python.exe >nul 2>&1

echo [2] ポート8001の使用プロセスを終了...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001" 2^>nul') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
)

echo [3] 2秒待機...
timeout /t 2 /nobreak >nul

echo [4] Electron起動...
npm start
