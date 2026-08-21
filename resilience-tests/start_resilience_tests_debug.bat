@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Virtual environment missing. Run start_resilience_tests.bat first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" resilience_interface.py
if errorlevel 1 (
  echo.
  echo [ERROR] The Tkinter interface exited with an error.
  echo Review results\logs\gui_startup_error.log.
  pause
  exit /b 1
)
endlocal
