@echo off
setlocal

set "ROOT_DIR=%~dp0"
call "%ROOT_DIR%training-host\start-traininghost.bat" %*

