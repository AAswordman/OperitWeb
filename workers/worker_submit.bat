@echo off
setlocal enabledelayedexpansion

REM Deploy a worker in the workers folder with one command.
REM Usage: workers\worker_submit.bat [worker-name]

set "ROOT=%~dp0.."
set "ENV_FILE=%ROOT%\.env.local"
set "WORKER_NAME=%~1"
if "%WORKER_NAME%"=="" set "WORKER_NAME=operit-api"
set "WORKER_DIR=%ROOT%\workers\%WORKER_NAME%"
set "NPM_CACHE=%ROOT%\.npm-cache"
set "NPM_REGISTRY=https://registry.npmjs.org/"
set "WRANGLER_ARGS=deploy"

if not exist "%WORKER_DIR%" (
  echo Missing worker directory: %WORKER_DIR%
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

if not exist "%NPM_CACHE%" (
  mkdir "%NPM_CACHE%" >nul 2>&1
)

set "NPM_CONFIG_CACHE=%NPM_CACHE%"
set "npm_config_cache=%NPM_CACHE%"
set "NPM_CONFIG_REGISTRY=%NPM_REGISTRY%"
set "npm_config_registry=%NPM_REGISTRY%"

if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo Missing CLOUDFLARE_API_TOKEN in .env.local. Cannot deploy.
  exit /b 2
)

pushd "%WORKER_DIR%" >nul

if not "%WORKER_WRANGLER_CMD%"=="" (
  echo Using WORKER_WRANGLER_CMD: %WORKER_WRANGLER_CMD%
  call %WORKER_WRANGLER_CMD%
  set "EXITCODE=%ERRORLEVEL%"
  popd >nul
  exit /b %EXITCODE%
)

if not "%OPERIT_WRANGLER_CMD%"=="" (
  echo Using OPERIT_WRANGLER_CMD: %OPERIT_WRANGLER_CMD%
  call %OPERIT_WRANGLER_CMD%
  set "EXITCODE=%ERRORLEVEL%"
  popd >nul
  exit /b %EXITCODE%
)

where npx >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Using npx wrangler deploy
  call npx wrangler %WRANGLER_ARGS%
  set "EXITCODE=%ERRORLEVEL%"
  popd >nul
  exit /b %EXITCODE%
)

REM Fallback to direct CLI from local npx cache if PATH tools are unavailable.
for /d %%D in ("%NPM_CACHE%\\_npx\\*") do (
  if exist "%%D\\node_modules\\wrangler\\wrangler-dist\\cli.js" (
    echo Using cached wrangler CLI
    call node "%%D\\node_modules\\wrangler\\wrangler-dist\\cli.js" %WRANGLER_ARGS%
    set "EXITCODE=%ERRORLEVEL%"
    popd >nul
    exit /b %EXITCODE%
  )
)

where pnpm >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Using pnpm wrangler deploy
  call pnpm wrangler %WRANGLER_ARGS%
  set "EXITCODE=%ERRORLEVEL%"
  popd >nul
  exit /b %EXITCODE%
)

where npm >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Using npm exec wrangler deploy
  call npm exec wrangler -- %WRANGLER_ARGS%
  set "EXITCODE=%ERRORLEVEL%"
  popd >nul
  exit /b %EXITCODE%
)

popd >nul
echo Could not find npx/pnpm/npm in PATH.
exit /b 4

