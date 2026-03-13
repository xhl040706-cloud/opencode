@echo off
setlocal enabledelayedexpansion

:: Define ANSI color codes
for /f %%A in ('echo prompt $E^| cmd') do set "ESC=%%A"
set "RED=!ESC![31m"
set "GREEN=!ESC![32m"
set "NC=!ESC![0m"
set "EXCL=!"

if not defined COSTRICT_BASE_URL (
    set COSTRICT_BASE_URL=https://zgsm.sangfor.com
)
set BASE_URL=%COSTRICT_BASE_URL%

:usage
if "%~1"=="-h" goto :show_help
if "%~1"=="--help" goto :show_help
if "%~1"=="-v" goto :check_version_arg
if "%~1"=="-b" goto :check_binary_arg
if "%~1"=="--binary" goto :check_binary_arg
goto :main

:show_help
echo.
echo CoStrict Installer for Windows
echo.
echo Usage: install.bat [options]
echo.
echo Options:
echo     -h, --help              Display this help message
echo     -v, --version ^<version^> Install a specific version (e.g. 1.0.180)
echo     -b, --binary ^<path^>     Install from a local binary instead of downloading
echo.
echo Environment Variables:
echo     COSTRICT_BASE_URL       Base URL for downloading (default: https://zgsm.sangfor.com)
echo.
echo Examples:
echo     install.bat -v 1.0.180
echo     COSTRICT_BASE_URL=https://zgsm.sangfor.com install.bat -v 1.0.180
echo     install.bat -b C:\path\to\costrict-cli.exe
echo.
exit /b 0

:check_version_arg
if "%~2"=="" (
    echo Error: --version requires a version argument
    exit /b 1
)
set "REQUESTED_VERSION=%~2"
shift
shift
if not "%~1"=="" goto :parse_args
goto :main

:check_binary_arg
if "%~2"=="" (
    echo Error: --binary requires a path argument
    exit /b 1
)
set "BINARY_PATH=%~2"
goto :main

:parse_args
if "%~1"=="-h" goto :show_help
if "%~1"=="--help" goto :show_help
if "%~1"=="-v" goto :check_version_arg
if "%~1"=="-b" goto :check_binary_arg
if "%~1"=="--binary" goto :check_binary_arg
echo Warning: Unknown option '%~1'
shift
goto :parse_args

:main
set "INSTALL_DIR=%USERPROFILE%\.costrict\bin"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if not "%BINARY_PATH%"=="" (
    if not exist "%BINARY_PATH%" (
        echo Error: Binary not found at %BINARY_PATH%
        exit /b 1
    )
    echo Installing cs from: %BINARY_PATH%
    copy /Y "%BINARY_PATH%" "%INSTALL_DIR%\cs.exe" >nul
    if errorlevel 1 (
        echo Error: Failed to copy binary
        exit /b 1
    )
    echo [OK] Installed successfully
    goto :add_to_path
)

if "%REQUESTED_VERSION%"=="" (
    echo No version specified, fetching latest version from server...
    set "LATEST_URL=%BASE_URL%/costrict-cli/pkg/latest.json"
    echo Fetching from: !LATEST_URL!
    
    :: Download latest.json and extract version using PowerShell
    for /f "delims=" %%V in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='!LATEST_URL!'; try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing; $json = $response.Content | ConvertFrom-Json; if ($json.tag_name) { Write-Output $json.tag_name } } catch { }"') do (
        set "REQUESTED_VERSION=%%V"
    )
    
    if "!REQUESTED_VERSION!"=="" (
        echo Error: Failed to fetch latest version from !LATEST_URL!
        echo.
        echo Please specify a version manually using: install.bat -v VERSION
        exit /b 1
    )
    echo Using latest version: !REQUESTED_VERSION!
)

:: Remove leading 'v' if present
if "%REQUESTED_VERSION:~0,1%"=="v" (
    set "REQUESTED_VERSION=%REQUESTED_VERSION:~1%"
)

:: Detect CPU architecture
set "ARCH=x64"

:: Detect AVX2 support using PowerShell
:: Default to baseline for safety
set "TARGET=costrict-cs-windows-!ARCH!-baseline"

echo Detecting CPU features...
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "try { Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class CPUID { [DllImport(\"kernel32.dll\")] public static extern IntPtr GetModuleHandle(string lpModuleName); [DllImport(\"kernel32.dll\")] public static extern IntPtr GetProcAddress(IntPtr hModule, string lpProcName); public static bool IsProcessorFeaturePresent(int feature) { IntPtr hKernel32 = GetModuleHandle(\"kernel32.dll\"); if (hKernel32 == IntPtr.Zero) return false; IntPtr pIsProcessorFeaturePresent = GetProcAddress(hKernel32, \"IsProcessorFeaturePresent\"); if (pIsProcessorFeaturePresent == IntPtr.Zero) return false; var func = (Func<int, bool>)Marshal.GetDelegateForFunctionPointer(pIsProcessorFeaturePresent, typeof(Func<int, bool>)); return func(feature); } }'; if ([CPUID]::IsProcessorFeaturePresent(40)) { Write-Output 'AVX2' } else { Write-Output 'BASELINE' } } catch { Write-Output 'BASELINE' }"`) do (
    if "%%A"=="AVX2" (
        set "TARGET=opencode-windows-!ARCH!"
        echo CPU supports AVX2, using optimized build
    ) else (
        echo CPU does not support AVX2 or detection failed, using baseline build
    )
)

set "ARCHIVE_EXT=.zip"
set "DOWNLOAD_URL=!BASE_URL!/costrict-cli/pkg/!REQUESTED_VERSION!/!TARGET!!ARCHIVE_EXT!"

echo.
echo Downloading cs version: !REQUESTED_VERSION!
echo Target: !TARGET!
echo URL: !DOWNLOAD_URL!
echo.

:: Use USERPROFILE if TEMP is not available
if not defined TEMP (
    set "TEMP=%USERPROFILE%\AppData\Local\Temp"
)

set "TEMP_DIR=!TEMP!\costrict-cli-!RANDOM!"
echo Creating temp directory: !TEMP_DIR!
mkdir "!TEMP_DIR!" 2>nul
if not exist "!TEMP_DIR!" (
    echo Error: Failed to create temp directory
    exit /b 1
)

set "ARCHIVE_PATH=!TEMP_DIR!\!TARGET!!ARCHIVE_EXT!"

:: Download using PowerShell in background with progress monitoring
echo Downloading from: !DOWNLOAD_URL!
echo Saving to: !ARCHIVE_PATH!
echo.

:: Create a PowerShell script for background download
set "DOWNLOAD_SCRIPT=!TEMP_DIR!\download.ps1"
echo $ProgressPreference = 'SilentlyContinue' > "!DOWNLOAD_SCRIPT!"
echo try { >> "!DOWNLOAD_SCRIPT!"
echo     $webClient = New-Object System.Net.WebClient >> "!DOWNLOAD_SCRIPT!"
echo     $webClient.Headers.Add('User-Agent', 'CoStrict-Installer') >> "!DOWNLOAD_SCRIPT!"
echo     $webClient.DownloadFile('!DOWNLOAD_URL!', '!ARCHIVE_PATH!') >> "!DOWNLOAD_SCRIPT!"
echo     exit 0 >> "!DOWNLOAD_SCRIPT!"
echo } catch { >> "!DOWNLOAD_SCRIPT!"
echo     Write-Host $_.Exception.Message >> "!DOWNLOAD_SCRIPT!"
echo     exit 1 >> "!DOWNLOAD_SCRIPT!"
echo } >> "!DOWNLOAD_SCRIPT!"

:: Start download in background
start /B powershell -NoProfile -ExecutionPolicy Bypass -File "!DOWNLOAD_SCRIPT!" > "!TEMP_DIR!\download.log" 2>&1

:: Monitor download progress
echo Downloading...
set /a LAST_SIZE=0
set /a RETRY_COUNT=0
:download_loop
timeout /t 2 /nobreak >nul 2>&1

:: Check if file exists and get size
if exist "!ARCHIVE_PATH!" (
    for %%A in ("!ARCHIVE_PATH!") do set CURRENT_SIZE=%%~zA
    
    :: Display progress
    set /a SIZE_MB=!CURRENT_SIZE! / 1048576
    echo   Downloaded: !SIZE_MB! MB ^(!CURRENT_SIZE! bytes^)
    
    :: Check if download is still progressing
    if !CURRENT_SIZE! GTR !LAST_SIZE! (
        set LAST_SIZE=!CURRENT_SIZE!
        set RETRY_COUNT=0
        goto :download_loop
    )
    
    :: Check if download is complete (file size stable for multiple checks)
    set /a RETRY_COUNT+=1
    if !RETRY_COUNT! LSS 3 (
        goto :download_loop
    )
) else (
    :: File doesn't exist yet, wait
    echo   Initializing download...
    goto :download_loop
)

:: Check download result
if exist "!TEMP_DIR!\download.log" (
    for /f "usebackq delims=" %%L in ("!TEMP_DIR!\download.log") do (
        echo Download error: %%L
        rmdir /S /Q "!TEMP_DIR!" 2>nul
        exit /b 1
    )
)

echo.
echo Download completed successfully
echo.

if not exist "!ARCHIVE_PATH!" (
    echo Error: Download failed - file not created
    rmdir /S /Q "!TEMP_DIR!" 2>nul
    exit /b 1
)

:: Check if file has content and size
echo Verifying downloaded file...
for %%A in ("!ARCHIVE_PATH!") do (
    set FILE_SIZE=%%~zA
)

:: Ensure FILE_SIZE is set
if not defined FILE_SIZE (
    echo Error: Could not determine file size
    rmdir /S /Q "!TEMP_DIR!"
    exit /b 1
)

echo File size: !FILE_SIZE! bytes

:: Check minimum size (1KB)
if !FILE_SIZE! LSS 1024 (
    echo Error: Downloaded file is too small ^(!FILE_SIZE! bytes^)
    echo Minimum required: 1024 bytes
    rmdir /S /Q "!TEMP_DIR!"
    exit /b 1
)

echo File verification passed
echo.
echo Extracting archive...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Write-Host 'Starting extraction...'; Expand-Archive -Path '!ARCHIVE_PATH!' -DestinationPath '!TEMP_DIR!' -Force; Write-Host 'Extraction completed successfully'; exit 0 } catch { Write-Host 'Extract failed:' $_.Exception.Message; if ($_.Exception.InnerException) { Write-Host 'Inner exception:' $_.Exception.InnerException.Message }; exit 1 }"

if errorlevel 1 (
    echo.
    echo Error: Failed to extract archive
    echo Please check if the downloaded file is a valid ZIP archive
    rmdir /S /Q "!TEMP_DIR!"
    exit /b 1
)

echo.

set "BINARY_SOURCE=!TEMP_DIR!\bin\cs.exe"
if not exist "!BINARY_SOURCE!" (
    echo Error: Binary not found in extracted archive
    rmdir /S /Q "!TEMP_DIR!"
    exit /b 1
)

move /Y "!BINARY_SOURCE!" "!INSTALL_DIR!\cs.exe" >nul
if errorlevel 1 (
    echo Error: Failed to move file to !INSTALL_DIR!
    rmdir /S /Q "!TEMP_DIR!"
    exit /b 1
)

rmdir /S /Q "!TEMP_DIR!"

echo [OK] Installed successfully to: !INSTALL_DIR!\cs.exe

:add_to_path
:: Check if INSTALL_DIR is already in user PATH environment variable
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('PATH', 'User')" | findstr /i "!INSTALL_DIR!" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo [OK] PATH already configured in user environment
    goto :install_base_url
)

:: Add INSTALL_DIR to user PATH environment variable using PowerShell
echo.
echo Adding !INSTALL_DIR! to user PATH...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User'); if ($currentPath -notlike '*!INSTALL_DIR!*') { $newPath = $currentPath + ';!INSTALL_DIR!'; [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User'); Write-Host '[OK] Added to user PATH environment variable' } else { Write-Host '[OK] Already in user PATH' }"
set "ENV_UPDATED=1"

:install_base_url
:: Add COSTRICT_BASE_URL to system environment variables (user level)
echo.
echo Setting COSTRICT_BASE_URL environment variable...

:: Use setx to add to user environment variables
setx COSTRICT_BASE_URL "!COSTRICT_BASE_URL!" >nul

if errorlevel 1 (
    echo Warning: Failed to set COSTRICT_BASE_URL permanently
    echo You may need to set it manually:
    echo   setx COSTRICT_BASE_URL "!COSTRICT_BASE_URL!"
) else (
    echo [OK] Added COSTRICT_BASE_URL to user environment variables
)

echo.
echo !GREEN!========================================!NC!
echo !GREEN!  CoStrict CLI Installation Complete!NC!
echo !GREEN!========================================!NC!
echo.

if "!ENV_UPDATED!"=="1" (
    echo !RED![!EXCL!] IMPORTANT: Please restart your terminal for PATH changes to take effect!NC!
    echo.
)

echo To start:
echo.
echo   cd ^<project^>    # Open directory
echo   cs       # Run command
echo.
echo For more information visit https://docs.costrict.ai
echo.

exit /b 0
