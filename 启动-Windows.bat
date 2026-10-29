@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe py -3 -m venv .venv
if errorlevel 1 goto error
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto error
.venv\Scripts\python.exe desktop.py
if errorlevel 1 goto error
exit /b 0
:error
echo Please install Python 3.13 or 3.14, then try again.
pause
exit /b 1
