@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_native_ripgrep.ps1" %*
