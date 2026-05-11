@echo off
setlocal enabledelayedexpansion

set "ROOT=%~dp0..\.."
set "ENV_FILE=%ROOT%\.env.local"
set "WORKER_DIR=%ROOT%\workers\market-stats"
set "CORS_FILE=%WORKER_DIR%\cors.json"
set "BUCKET_NAME=operit-market-stats-static"
set "NPM_CACHE=%ROOT%\.npm-cache"
set "NPM_REGISTRY=https://registry.npmjs.org/"

if not exist "%CORS_FILE%" (
  echo Missing CORS file: %CORS_FILE%
  exit /b 3
)

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
  echo Missing CLOUDFLARE_API_TOKEN in .env.local. Cannot apply bucket CORS.
  exit /b 2
)

if not exist "%NPM_CACHE%" (
  mkdir "%NPM_CACHE%" >nul 2>&1
)

set "NPM_CONFIG_CACHE=%NPM_CACHE%"
set "npm_config_cache=%NPM_CACHE%"
set "NPM_CONFIG_REGISTRY=%NPM_REGISTRY%"
set "npm_config_registry=%NPM_REGISTRY%"

pushd "%WORKER_DIR%" >nul

where npx >nul 2>&1
if errorlevel 1 (
  echo Missing npx in PATH.
  popd >nul
  exit /b 4
)

echo Applying R2 bucket CORS to %BUCKET_NAME%...
call npx wrangler r2 bucket cors set %BUCKET_NAME% --file "%CORS_FILE%"
if errorlevel 1 (
  set "EXITCODE=%ERRORLEVEL%"
  popd >nul
  exit /b %EXITCODE%
)

echo.
echo Current bucket CORS:
call npx wrangler r2 bucket cors list %BUCKET_NAME%
set "EXITCODE=%ERRORLEVEL%"
popd >nul

echo.
echo CORS has been written to the R2 bucket.
echo If static.operit.app still returns old headers, wait up to 5 minutes or purge the static domain cache.
exit /b %EXITCODE%
