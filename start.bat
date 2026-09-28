@echo off
chcp 65001 >nul
title LKGT Studio
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is required: https://nodejs.org  ^(LTS^)
  echo  يلزم تثبيت Node.js أولاً من الرابط أعلاه
  echo.
  pause
  exit /b
)
if not exist node_modules (
  echo Installing packages... / تثبيت الحزم لأول مرة...
  call npm install
)
call npm run dev
pause
