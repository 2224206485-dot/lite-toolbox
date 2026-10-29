@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe py -3 -m venv .venv
if errorlevel 1 goto error
.venv\Scripts\python.exe -m pip install -r requirements-build.txt
if errorlevel 1 goto error
.venv\Scripts\python.exe -m unittest discover -s tests -v
if errorlevel 1 goto error
.venv\Scripts\python.exe build.py
if errorlevel 1 goto error
echo Ready: dist\LiteToolbox\LiteToolbox.exe
echo Distribute the entire dist\LiteToolbox folder.
pause
exit /b 0
:error
echo Build failed. Please check the error above.
pause
exit /b 1
