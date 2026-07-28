@echo off
setlocal
rem Launch Sect Master: Path of Ascension. Double-click this file to play.
rem Runs from its own folder, so it works no matter where the shortcut lives.
cd /d "%~dp0"

echo ==================================================
echo    Sect Master: Path of Ascension
echo ==================================================
echo.

rem Node.js ships npm; the game's dev server needs it.
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm was not found.
  echo Install Node.js from https://nodejs.org/ then run this again.
  echo.
  pause
  exit /b 1
)

rem First run only: pull down dependencies.
if not exist "node_modules" (
  echo First launch detected - installing dependencies. This can take a minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency install failed. See the messages above.
    pause
    exit /b 1
  )
  echo.
)

echo Starting the game. Your browser will open at http://localhost:5173
echo Keep this window open while you play. Close it or press Ctrl+C to stop.
echo.

rem --open tells Vite to launch the browser once the server is actually ready.
call npm run dev -- --open

rem If the server exits (or fails to start), keep the window up so errors stay readable.
echo.
echo The game server has stopped.
pause
endlocal
