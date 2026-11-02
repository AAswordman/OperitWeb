@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "LOCAL_ROOT=%SCRIPT_DIR%..\..\debug_output\compose_dsl_dump"

adb version >nul 2>&1 || (
    echo Error: adb not found in PATH
    exit /b 1
)

set "DEVICE_SERIAL="
set "DEVICE_COUNT=0"
for /f "skip=1 tokens=1,2" %%a in ('adb devices') do (
    if "%%b"=="device" (
        set /a DEVICE_COUNT+=1
        set "DEVICE_!DEVICE_COUNT!=%%a"
    )
)

if %DEVICE_COUNT% equ 0 (
    echo Error: no authorized Android device found
    exit /b 1
)

if %DEVICE_COUNT% equ 1 (
    set "DEVICE_SERIAL=!DEVICE_1!"
) else (
    echo Multiple devices detected:
    for /l %%i in (1,1,%DEVICE_COUNT%) do echo   %%i. !DEVICE_%%i!
    :select_device
    set /p "CHOICE=Select device (1-%DEVICE_COUNT%): "
    echo !CHOICE!|findstr /r "^[1-9][0-9]*$" >nul || (
        echo Invalid input
        goto :select_device
    )
    if !CHOICE! lss 1 goto :select_device
    if !CHOICE! gtr %DEVICE_COUNT% goto :select_device
    for %%i in (!CHOICE!) do set "DEVICE_SERIAL=!DEVICE_%%i!"
)

REM Resolve the installed Debug or Release application package.
set "APP_ID=%OPERIT_APP_PACKAGE%"
if defined APP_ID (
    if /I not "!APP_ID!"=="com.ai.assistance.operit.debug" if /I not "!APP_ID!"=="com.ai.assistance.operit" (
        echo Error: Unsupported Operit application package - !APP_ID!
        exit /b 1
    )
    adb -s "!DEVICE_SERIAL!" shell pm list packages "!APP_ID!" | findstr /x /c:"package:!APP_ID!" >nul
    if errorlevel 1 (
        echo Error: Operit application package is not installed - !APP_ID!
        exit /b 1
    )
) else (
    set "APP_ID="
    for %%P in (com.ai.assistance.operit.debug com.ai.assistance.operit) do (
        if not defined APP_ID (
            adb -s "!DEVICE_SERIAL!" shell pm list packages "%%P" | findstr /x /c:"package:%%P" >nul
            if not errorlevel 1 set "APP_ID=%%P"
        )
    )
    if not defined APP_ID (
        echo Error: Neither supported Operit application package is installed
        exit /b 1
    )
)
set "ACTION=!APP_ID!.DUMP_COMPOSE_DSL_UI"
set "RECEIVER=!APP_ID!/.core.tools.packTool.ToolPkgComposeDslDebugDumpReceiver"
set "REMOTE_DIR=/sdcard/Android/data/!APP_ID!/files/debug/compose_dsl_dump/current"
echo Using Operit application package: !APP_ID!

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyyMMdd-HHmmss')"') do set "TIMESTAMP=%%i"
if not exist "%LOCAL_ROOT%" mkdir "%LOCAL_ROOT%"
set "LOCAL_DIR=%LOCAL_ROOT%\%TIMESTAMP%"

echo Triggering compose_dsl dump on %DEVICE_SERIAL%...
adb -s "%DEVICE_SERIAL%" shell "am broadcast -a %ACTION% -n %RECEIVER% --include-stopped-packages" >nul
if errorlevel 1 (
    echo Error: failed to send dump broadcast
    exit /b 1
)

set "READY="
for /l %%i in (1,1,10) do (
    adb -s "%DEVICE_SERIAL%" shell "if [ -d '%REMOTE_DIR%' ]; then echo __READY__; fi" | findstr "__READY__" >nul
    if not errorlevel 1 (
        set "READY=1"
        goto :pull_dump
    )
    timeout /t 1 /nobreak >nul
)

if not defined READY (
    echo Error: dump directory was not created: %REMOTE_DIR%
    exit /b 1
)

:pull_dump
echo Pulling dump to %LOCAL_DIR%...
adb -s "%DEVICE_SERIAL%" pull "%REMOTE_DIR%" "%LOCAL_DIR%" >nul
if errorlevel 1 (
    echo Error: failed to pull dump directory
    exit /b 1
)

echo.
echo Dump saved to:
echo %LOCAL_DIR%
echo.
echo Files:
echo   dump_manifest.json
echo   source_script.js
echo   raw_render_result.txt / .json
echo   parsed_render_result.json
echo   compose_tree.json / .txt
echo   compose_layout_tree.txt
echo   layout_nodes.json / .txt
echo   state.json
echo   memo.json
