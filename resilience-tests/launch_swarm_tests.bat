@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" exit /b 1
".venv\Scripts\python.exe" run_swarm_tests.py %*
exit /b %ERRORLEVEL%
