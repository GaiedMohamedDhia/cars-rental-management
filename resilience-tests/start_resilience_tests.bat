@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

if not exist ".venv\Scripts\python.exe" (
  where py >nul 2>&1
  if not errorlevel 1 (
    py -3 -m venv .venv
  ) else (
    where python >nul 2>&1
    if errorlevel 1 goto python_missing
    python -m venv .venv
  )
  if errorlevel 1 goto venv_error
)

".venv\Scripts\python.exe" -c "import PIL, jinja2, matplotlib, pandas, psutil, pytest, requests, yaml" >nul 2>&1
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto dependency_error
)

if exist ".venv\Scripts\pythonw.exe" (
  ".venv\Scripts\pythonw.exe" resilience_interface.py
) else (
  ".venv\Scripts\python.exe" resilience_interface.py
)
if errorlevel 1 goto gui_error
exit /b 0

:python_missing
echo [ERROR] Python 3 was not found. Install Python and enable the py launcher or PATH entry.
goto failure
:venv_error
echo [ERROR] Failed to create the virtual environment.
goto failure
:dependency_error
echo [ERROR] Dependency installation failed.
goto failure
:gui_error
echo [ERROR] The Tkinter interface failed to start.
echo Review results\logs\gui_startup_error.log.
:failure
pause
exit /b 1
