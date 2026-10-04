@echo off
rem Double-click this file in File Explorer to play Reactor.
rem It installs dependencies on first run, builds the game when needed,
rem and opens it in your default browser. Close this window to stop it.
setlocal
cd /d "%~dp0"
title Reactor Quest

where node >nul 2>nul && goto run
rem Not on PATH yet (a fresh install needs a new window): try the usual places.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "PATH=%NVM_SYMLINK%;%PATH%"
where node >nul 2>nul && goto run

echo Reactor needs Node.js (version 20.19 or newer).
echo Install it from https://nodejs.org  - or in a terminal:  winget install OpenJS.NodeJS.LTS
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:run
node tools\launch.mjs %*
if errorlevel 1 pause
