::  SPDX-License-Identifier: Apache-2.0
:: 
::  Copyright 2025 Eaton
:: 
::  Licensed under the Apache License, Version 2.0 (the "License");
::  you may not use this file except in compliance with the License.
::  You may obtain a copy of the License at
:: 
::      http://www.apache.org/licenses/LICENSE-2.0
:: 
::  Unless required by applicable law or agreed to in writing, software
::  distributed under the License is distributed on an "AS IS" BASIS,
::  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
::  See the License for the specific language governing permissions and
:: 
::  File: ems-launcher.bat
::  Description: # TODO: Add desc
::
::  Created: 1st January 2025
::  Last Modified: 30th October 2025
::  Version: v1.0.0


@echo off
setlocal enabledelayedexpansion

:: Enable color support
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
if "%version%" geq "10.0" (
    :: Windows 10+ supports ANSI escape sequences
    set "RED=[91m"
    set "GREEN=[92m"
    set "YELLOW=[93m"
    set "BLUE=[94m"
    set "MAGENTA=[95m"
    set "CYAN=[96m"
    set "WHITE=[97m"
    set "RESET=[0m"
    set "BOLD=[1m"
) else (
    :: Fallback for older Windows versions
    set "RED="
    set "GREEN="
    set "YELLOW="
    set "BLUE="
    set "MAGENTA="
    set "CYAN="
    set "WHITE="
    set "RESET="
    set "BOLD="
)


:: Title
echo %BOLD%%CYAN%========================================%RESET%
echo %BOLD%%CYAN%    EMS LAUNCHER%RESET%
echo %BOLD%%CYAN%========================================%RESET%
echo.

:: Check if required executables exist
echo %YELLOW%Checking prerequisites...%RESET%

where pg_ctl.exe >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: pg_ctl.exe not found in PATH%RESET%
    echo %YELLOW%Please ensure PostgreSQL is installed and added to PATH%RESET%
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: npm not found in PATH%RESET%
    echo %YELLOW%Please ensure Node.js/npm is installed%RESET%
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: node not found in PATH%RESET%
    echo %YELLOW%Please ensure Node.js is installed%RESET%
    pause
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: python not found in PATH%RESET%
    echo %YELLOW%Please ensure Python is installed%RESET%
    pause
    exit /b 1
)

echo %GREEN%All prerequisites found!%RESET%
echo.

:: Start PostgreSQL
echo %BOLD%%BLUE%[1/4] Starting PostgreSQL server...%RESET%
start "PostgreSQL Server" cmd /k "echo %MAGENTA%PostgreSQL Server%RESET% && pg_ctl.exe start -D "C:\Users\YOUR_USER\Documents\1_SHIFT2DC\1_1_EMS Data" && echo %GREEN%PostgreSQL started successfully!%RESET%"
timeout /t 3 /nobreak >nul

:: Start Frontend Server
echo %BOLD%%BLUE%[2/4] Starting Frontend server...%RESET%
cd "web-app/frontend"
start "Frontend Server" cmd /k "echo %MAGENTA%Frontend Server%RESET% && npm run dev && echo %GREEN%Frontend server started!%RESET%"
timeout /t 2 /nobreak >nul

:: Start Backend Server
echo %BOLD%%BLUE%[3/4] Starting Backend server...%RESET%
cd ..\..
cd "web-app/backend"
start "Backend Server" cmd /k "echo %MAGENTA%Backend Server%RESET% && node server.js && echo %GREEN%Backend server started!%RESET%"
timeout /t 2 /nobreak >nul

:: Start Python Coordinator with Virtual Environment
echo %BOLD%%BLUE%[4/4] Starting Python coordinator...%RESET%
cd ..\..
cd "system-coordination"
start "Python Coordinator" cmd /k "echo %MAGENTA%Python Coordinator%RESET% && sys-coord\Scripts\activate && %PYTHON_CMD% py coordinator.py && echo %GREEN%Python coordinator started!%RESET%"

echo.
echo %BOLD%%GREEN%========================================%RESET%
echo %BOLD%%GREEN%   ALL SERVICES LAUNCHED SUCCESSFULLY%RESET%
echo %BOLD%%GREEN%========================================%RESET%
echo.
echo %CYAN%Services running:%RESET%
echo %WHITE%- PostgreSQL Server%RESET%
echo %WHITE%- Frontend React Server%RESET%
echo %WHITE%- Backend Server%RESET%
echo %WHITE%- Python Coordinator (in venv)%RESET%
echo.
echo %YELLOW%Press any key to exit launcher (services will continue running)...%RESET%
pause >nul