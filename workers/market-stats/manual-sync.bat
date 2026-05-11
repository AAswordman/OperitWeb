@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "WORKER_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%WORKER_DIR%\..\..") do set "ROOT=%%~fI"
set "ENV_FILE=%ROOT%\.env.local"

if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1* delims==" %%A in ("%ENV_FILE%") do (
    set "KEY=%%A"
    set "VAL=%%B"
    if not "!KEY!"=="" if not "!KEY:~0,1!"=="#" (
      if "!VAL:~0,1!"=="^"" set "VAL=!VAL:~1,-1!"
      set "!KEY!=!VAL!"
    )
  )
)

if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo Missing CLOUDFLARE_API_TOKEN in %ENV_FILE%.
  exit /b 2
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo PowerShell was not found in PATH.
  exit /b 3
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%WORKER_DIR%\manual-sync.ps1" -WorkerDir "%WORKER_DIR%"
exit /b %ERRORLEVEL%
