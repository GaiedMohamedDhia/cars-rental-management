@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Missing .venv. Install requirements first.
  exit /b 1
)
".venv\Scripts\python.exe" run_all_tests.py %*
exit /b %ERRORLEVEL%
