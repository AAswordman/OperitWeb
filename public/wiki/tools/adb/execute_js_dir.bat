@echo off
setlocal EnableDelayedExpansion

REM Execute a JS function from a whole directory (supports require()) via ADB.
REM
REM Usage:
REM   execute_js_dir.bat <suite_dir> [entry_js_rel_path] [function_name] [parameters_JSON|@params_file] [env_file_path]
REM
REM Examples:
REM   execute_js_dir.bat app\\src\\androidTest\\js com\\ai\\assistance\\operit\\util\\ttscleaner\\main.js run "{}"
REM   execute_js_dir.bat app\\src\\androidTest\\js com\\ai\\assistance\\operit\\util\\ttscleaner\\main.js run @params.json
REM
REM Notes:
REM - Inline JSON is written into a temp file then pushed to device (avoids quoting issues).
REM - If env_file_path is omitted, tries <suite_dir>\.env.local
REM - Bundles the entry with esbuild first, so shared local modules work without app-side module loading.
REM - set OPERIT_RESULT_WAIT_SECONDS to customize result wait, default is 15 seconds

if "%~1"=="" (
    echo Usage: %0 ^<suite_dir^> [entry_js_rel_path] [function_name] [parameters_JSON^|@params_file] [env_file_path]
    exit /b 1
)

set "SUITE_DIR=%~1"
set "ENTRY_REL=%~2"
set "FUNCTION_NAME=%~3"
set "PARAMS_ARG=%~4"
set "ENV_FILE_PATH=%~5"

if "%ENTRY_REL%"=="" set "ENTRY_REL=main.js"
if "%FUNCTION_NAME%"=="" set "FUNCTION_NAME=run"
if "%PARAMS_ARG%"=="" set "PARAMS_ARG={}"

if "%OPERIT_RESULT_WAIT_SECONDS%"=="" (
    set "RESULT_WAIT_SECONDS=15"
) else (
    set "RESULT_WAIT_SECONDS=%OPERIT_RESULT_WAIT_SECONDS%"
)

if not exist "%SUITE_DIR%" (
    echo Error: Suite directory does not exist - %SUITE_DIR%
    exit /b 1
)

set "ENTRY_REL_LOCAL=%ENTRY_REL:/=\\%"
if not exist "%SUITE_DIR%\\%ENTRY_REL_LOCAL%" (
    echo Error: Entry file does not exist - %SUITE_DIR%\\%ENTRY_REL_LOCAL%
    exit /b 1
)

adb version >nul 2>&1 || (
    echo Error: ADB command not found.
    exit /b 1
)

REM Device detection
set "DEVICE_SERIAL="
set "DEVICE_COUNT=0"
echo Checking connected devices...

for /f "skip=1 tokens=1,2" %%a in ('adb devices') do (
    if "%%b" == "device" (
        set /a DEVICE_COUNT+=1
        set "DEVICE_!DEVICE_COUNT!=%%a"
        echo [!DEVICE_COUNT!] %%a
    )
)

if %DEVICE_COUNT% equ 0 (
    echo Error: No authorized devices found
    exit /b 1
)

if %DEVICE_COUNT% equ 1 (
    set "DEVICE_SERIAL=!DEVICE_1!"
    echo Using the only connected device: !DEVICE_SERIAL!
) else (
    :device_menu
    echo Multiple devices detected:
    for /l %%i in (1,1,%DEVICE_COUNT%) do echo   %%i. !DEVICE_%%i!
    set /p "CHOICE=Select device (1-%DEVICE_COUNT%): "
    echo !CHOICE!|findstr /r "^[1-9][0-9]*$" >nul || (
        echo Invalid input. Numbers only.
        goto :device_menu
    )
    set /a CHOICE=!CHOICE! >nul
    if !CHOICE! lss 1 (
        echo Number too small
        goto :device_menu
    )
    if !CHOICE! gtr %DEVICE_COUNT% (
        echo Number too large
        goto :device_menu
    )
    for %%i in (!CHOICE!) do set "DEVICE_SERIAL=!DEVICE_%%i!"
    echo Selected device: !DEVICE_SERIAL!
)

REM Resolve the installed Debug or Release application package.
set "APP_PACKAGE=%OPERIT_APP_PACKAGE%"
if defined APP_PACKAGE (
    if /I not "!APP_PACKAGE!"=="com.ai.assistance.operit.debug" if /I not "!APP_PACKAGE!"=="com.ai.assistance.operit" (
        echo Error: Unsupported Operit application package - !APP_PACKAGE!
        exit /b 1
    )
    adb -s "!DEVICE_SERIAL!" shell pm list packages "!APP_PACKAGE!" | findstr /x /c:"package:!APP_PACKAGE!" >nul
    if errorlevel 1 (
        echo Error: Operit application package is not installed - !APP_PACKAGE!
        exit /b 1
    )
) else (
    set "APP_PACKAGE="
    for %%P in (com.ai.assistance.operit.debug com.ai.assistance.operit) do (
        if not defined APP_PACKAGE (
            adb -s "!DEVICE_SERIAL!" shell pm list packages "%%P" | findstr /x /c:"package:%%P" >nul
            if not errorlevel 1 set "APP_PACKAGE=%%P"
        )
    )
    if not defined APP_PACKAGE (
        echo Error: Neither supported Operit application package is installed
        exit /b 1
    )
)
set "EXECUTE_JS_ACTION=com.ai.assistance.operit.EXECUTE_JS"
set "SCRIPT_EXECUTION_RECEIVER=!APP_PACKAGE!/.core.tools.javascript.ScriptExecutionReceiver"
echo Using Operit application package: !APP_PACKAGE!

endlocal & set "DEVICE_SERIAL=%DEVICE_SERIAL%" & set "APP_PACKAGE=%APP_PACKAGE%" & set "EXECUTE_JS_ACTION=%EXECUTE_JS_ACTION%" & set "SCRIPT_EXECUTION_RECEIVER=%SCRIPT_EXECUTION_RECEIVER%" & set "SUITE_DIR=%SUITE_DIR%" & set "ENTRY_REL=%ENTRY_REL%" & set "ENTRY_REL_LOCAL=%ENTRY_REL_LOCAL%" & set "FUNCTION_NAME=%FUNCTION_NAME%" & set "PARAMS_ARG=%PARAMS_ARG%" & set "ENV_FILE_PATH=%ENV_FILE_PATH%" & set "RESULT_WAIT_SECONDS=%RESULT_WAIT_SECONDS%"
setlocal EnableExtensions DisableDelayedExpansion

REM Resolve suite name
for %%D in ("%SUITE_DIR%") do set "SUITE_NAME=%%~nxD"

set "TARGET_BASE=/sdcard/Android/data/%APP_PACKAGE%/js_temp"
set "TARGET_SUITES_DIR=%TARGET_BASE%/suites"
set "TARGET_RESULT_FILE=%TARGET_BASE%/%SUITE_NAME%_%FUNCTION_NAME%_%RANDOM%.json"
set "BUNDLED_FILE="
set "OPERIT_TEMP_EXT=.js"
set "OPERIT_TEMP_PREFIX=operit_js_bundle_"
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$tmp = [System.IO.Path]::GetTempFileName(); $ext = $env:OPERIT_TEMP_EXT; $prefix = $env:OPERIT_TEMP_PREFIX; $dir = [System.IO.Path]::GetDirectoryName($tmp); $base = [System.IO.Path]::GetFileNameWithoutExtension($tmp); $target = Join-Path $dir ($prefix + $base + $ext); Move-Item -LiteralPath $tmp -Destination $target -Force; Write-Output $target"`) do (
    set "BUNDLED_FILE=%%T"
)
set "OPERIT_TEMP_EXT="
set "OPERIT_TEMP_PREFIX="
if not defined BUNDLED_FILE (
    echo Error: Failed to allocate bundle temp file
    exit /b 1
)

call npx esbuild "%SUITE_DIR%\%ENTRY_REL_LOCAL%" --bundle --format=cjs --platform=neutral --outfile="%BUNDLED_FILE%" --log-level=error
if errorlevel 1 (
    echo Error: Failed to bundle entry script with esbuild
    exit /b 1
)

echo Preparing device directory...
adb -s "%DEVICE_SERIAL%" shell mkdir -p "%TARGET_SUITES_DIR%"

for %%F in ("%BUNDLED_FILE%") do set "TARGET_ENTRY_FILE=%TARGET_SUITES_DIR%/%%~nxF"

echo Pushing bundled entry [%BUNDLED_FILE%] to device...
adb -s "%DEVICE_SERIAL%" push "%BUNDLED_FILE%" "%TARGET_ENTRY_FILE%"
if errorlevel 1 (
    del /q "%BUNDLED_FILE%" >nul 2>&1
    echo Error: Failed to push suite directory
    exit /b 1
)
del /q "%BUNDLED_FILE%" >nul 2>&1

REM Resolve env file path
if "%ENV_FILE_PATH%"=="" (
    if exist "%SUITE_DIR%\\.env.local" (
        set "ENV_FILE_PATH=%SUITE_DIR%\\.env.local"
    )
)

set "TARGET_ENV_FILE="
set "HAS_ENV_FILE=false"
if not "%ENV_FILE_PATH%"=="" (
    if exist "%ENV_FILE_PATH%" (
        for %%E in ("%ENV_FILE_PATH%") do set "TARGET_ENV_FILE=%TARGET_BASE%/%%~nxE"
        echo Pushing env file [%ENV_FILE_PATH%] to device...
        adb -s "%DEVICE_SERIAL%" push "%ENV_FILE_PATH%" "%TARGET_ENV_FILE%"
        if errorlevel 1 (
            echo Error: Failed to push env file
            exit /b 1
        )
        set "HAS_ENV_FILE=true"
    )
)

set "LOCAL_PARAMS_FILE="
set "PARAMS_PREVIEW=%PARAMS_ARG%"
set "PARAMS_LOCAL_TEMP=false"

if not defined PARAMS_ARG set "PARAMS_ARG={}"

if "%PARAMS_ARG:~0,1%"=="@" (
    call set "LOCAL_PARAMS_FILE=%%PARAMS_ARG:~1%%"
)

if defined LOCAL_PARAMS_FILE (
    if not exist "%LOCAL_PARAMS_FILE%" (
        echo Error: Params file does not exist - %LOCAL_PARAMS_FILE%
        exit /b 1
    )
) else (
    set "PARAMS_LOCAL_TEMP=true"
    set "OPERIT_TEMP_EXT=.json"
    set "OPERIT_TEMP_PREFIX=operit_js_params_"
    for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$tmp = [System.IO.Path]::GetTempFileName(); $ext = $env:OPERIT_TEMP_EXT; $prefix = $env:OPERIT_TEMP_PREFIX; $dir = [System.IO.Path]::GetDirectoryName($tmp); $base = [System.IO.Path]::GetFileNameWithoutExtension($tmp); $target = Join-Path $dir ($prefix + $base + $ext); Move-Item -LiteralPath $tmp -Destination $target -Force; Write-Output $target"`) do (
        set "LOCAL_PARAMS_FILE=%%T"
    )
    set "OPERIT_TEMP_EXT="
    set "OPERIT_TEMP_PREFIX="
    call set "OPERIT_JSON_FILE=%%LOCAL_PARAMS_FILE%%"
    if not defined OPERIT_JSON_FILE (
        echo Error: Failed to allocate local params temp file
        exit /b 1
    )
    set "OPERIT_JSON_CONTENT=%PARAMS_ARG%"
    powershell -NoProfile -Command "[System.IO.File]::WriteAllText($env:OPERIT_JSON_FILE, $env:OPERIT_JSON_CONTENT, [System.Text.UTF8Encoding]::new($false))"
    set "OPERIT_JSON_FILE="
    set "OPERIT_JSON_CONTENT="
    if errorlevel 1 (
        echo Error: Failed to create local params file
        exit /b 1
    )
)

for %%P in ("%LOCAL_PARAMS_FILE%") do set "TARGET_PARAMS_FILE=%TARGET_BASE%/%%~nP_%RANDOM%.json"

echo Pushing params [%PARAMS_PREVIEW%] to device...
adb -s "%DEVICE_SERIAL%" push "%LOCAL_PARAMS_FILE%" "%TARGET_PARAMS_FILE%"
if errorlevel 1 (
    if "%PARAMS_LOCAL_TEMP%"=="true" (
        if exist "%LOCAL_PARAMS_FILE%" del /q "%LOCAL_PARAMS_FILE%" >nul 2>&1
    )
    echo Error: Failed to push params file
    exit /b 1
)

adb -s "%DEVICE_SERIAL%" shell rm -f "%TARGET_RESULT_FILE%"

echo Executing [%FUNCTION_NAME%] from [%TARGET_ENTRY_FILE%] ...
if "%HAS_ENV_FILE%"=="true" (
    adb -s "%DEVICE_SERIAL%" shell "am broadcast -a %EXECUTE_JS_ACTION% -n %SCRIPT_EXECUTION_RECEIVER% --include-stopped-packages --es file_path '%TARGET_ENTRY_FILE%' --es function_name '%FUNCTION_NAME%' --es params_file_path '%TARGET_PARAMS_FILE%' --es env_file_path '%TARGET_ENV_FILE%' --es result_file_path '%TARGET_RESULT_FILE%' --ez temp_params_file true --ez temp_env_file true"
) else (
    adb -s "%DEVICE_SERIAL%" shell "am broadcast -a %EXECUTE_JS_ACTION% -n %SCRIPT_EXECUTION_RECEIVER% --include-stopped-packages --es file_path '%TARGET_ENTRY_FILE%' --es function_name '%FUNCTION_NAME%' --es params_file_path '%TARGET_PARAMS_FILE%' --es result_file_path '%TARGET_RESULT_FILE%' --ez temp_params_file true"
)
if errorlevel 1 (
    if "%PARAMS_LOCAL_TEMP%"=="true" (
        if exist "%LOCAL_PARAMS_FILE%" del /q "%LOCAL_PARAMS_FILE%" >nul 2>&1
    )
    echo Error: Failed to send execution broadcast
    exit /b 1
)

if "%PARAMS_LOCAL_TEMP%"=="true" (
    if exist "%LOCAL_PARAMS_FILE%" del /q "%LOCAL_PARAMS_FILE%" >nul 2>&1
)

echo Waiting up to %RESULT_WAIT_SECONDS%s for structured result...
set "RESULT_READY="
for /l %%i in (1,1,%RESULT_WAIT_SECONDS%) do (
    adb -s "%DEVICE_SERIAL%" shell "if [ -f '%TARGET_RESULT_FILE%' ]; then echo __READY__; fi" | findstr "__READY__" >nul
    if not errorlevel 1 (
        set "RESULT_READY=1"
        goto :result_ready
    )
    powershell -NoProfile -Command "Start-Sleep -Seconds 1" >nul
)

if not defined RESULT_READY (
    echo Error: Timed out waiting for result file: %TARGET_RESULT_FILE%
    exit /b 1
)

:result_ready
set "LOCAL_RESULT_FILE="
set "OPERIT_TEMP_EXT=.json"
set "OPERIT_TEMP_PREFIX=operit_js_result_"
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$tmp = [System.IO.Path]::GetTempFileName(); $ext = $env:OPERIT_TEMP_EXT; $prefix = $env:OPERIT_TEMP_PREFIX; $dir = [System.IO.Path]::GetDirectoryName($tmp); $base = [System.IO.Path]::GetFileNameWithoutExtension($tmp); $target = Join-Path $dir ($prefix + $base + $ext); Move-Item -LiteralPath $tmp -Destination $target -Force; Write-Output $target"`) do (
    set "LOCAL_RESULT_FILE=%%T"
)
set "OPERIT_TEMP_EXT="
set "OPERIT_TEMP_PREFIX="
if not defined LOCAL_RESULT_FILE (
    echo Error: Failed to create local result temp file
    adb -s "%DEVICE_SERIAL%" shell rm -f "%TARGET_RESULT_FILE%"
    exit /b 1
)
adb -s "%DEVICE_SERIAL%" shell "cat '%TARGET_RESULT_FILE%'" > "%LOCAL_RESULT_FILE%"
if errorlevel 1 (
    echo Error: Failed to read structured result file
    adb -s "%DEVICE_SERIAL%" shell rm -f "%TARGET_RESULT_FILE%"
    exit /b 1
)

echo Structured execution summary:
set "OPERIT_RESULT_FILE=%LOCAL_RESULT_FILE%"
powershell -NoProfile -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$path = $env:OPERIT_RESULT_FILE;" ^
  "$raw = Get-Content -Raw -Path $path;" ^
  "$data = $raw | ConvertFrom-Json;" ^
  "$status = if ($data.success) { 'PASS' } else { 'FAIL' };" ^
  "$result = $data.result;" ^
  "$resultProperties = if ($null -ne $result -and $result.PSObject) { @($result.PSObject.Properties.Name) } else { @() };" ^
  "$isTestSummary = ($result -isnot [System.Array]) -and ($resultProperties -contains 'passed') -and ($resultProperties -contains 'failed');" ^
  "if ($null -ne $result -and $null -ne $result.success -and -not $result.success) { $status = 'FAIL'; }" ^
  "Write-Host ('Status   : ' + $status);" ^
  "if ($data.scriptPath) { Write-Host ('Script   : ' + $data.scriptPath); }" ^
  "if ($data.functionName) { Write-Host ('Function : ' + $data.functionName); }" ^
  "if ($null -ne $data.durationMs) { Write-Host ('Duration : ' + $data.durationMs + ' ms'); }" ^
  "if ($data.error) { Write-Host ('Error    : ' + $data.error); }" ^
  "if ($isTestSummary) { Write-Host ('Tests    : ' + $result.passed + ' passed, ' + $result.failed + ' failed'); if ($result.suites -and $result.suites.Count -gt 0) { Write-Host 'Suites   :'; foreach ($suite in $result.suites) { $suiteStatus = if ($suite.success) { 'PASS' } else { 'FAIL' }; Write-Host ('  - ' + $suite.name + ': ' + $suiteStatus + ' [' + $suite.passed + ' passed, ' + $suite.failed + ' failed, ' + $suite.durationMs + ' ms]'); } } if ($result.failures -and $result.failures.Count -gt 0) { Write-Host 'Failures :'; foreach ($failure in $result.failures) { Write-Host ('  - ' + $failure.name); if ($failure.error) { Write-Host ('    ' + ($failure.error -replace \"`r?`n\", ' ')); } } } } elseif ($null -ne $result) { Write-Host 'Result   :'; $result | ConvertTo-Json -Depth 100; }" ^
  "if ($data.events -and $data.events.Count -gt 0) { Write-Host 'Events   :'; foreach ($event in $data.events) { Write-Host ('  - ' + $event); } }" ^
  "if ($env:OPERIT_SHOW_RAW_RESULT -eq '1') { Write-Host ''; Write-Host 'Raw JSON :'; Write-Host $raw; }"
if errorlevel 1 (
    echo Structured execution result ^(raw^):
    type "%LOCAL_RESULT_FILE%"
)

del /q "%LOCAL_RESULT_FILE%" >nul 2>&1
adb -s "%DEVICE_SERIAL%" shell rm -f "%TARGET_RESULT_FILE%"
exit /b 0
