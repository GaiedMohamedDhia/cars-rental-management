@echo off
cd /d "%~dp0"
call "%~dp0start_resilience_tests.bat" %*
exit /b %ERRORLEVEL%

