@echo off
rem Builds Aseprite from source (D:\tools\aseprite) for the pixel-mcp server. See docs/TECHNICAL_GUIDE.fa.md section 3.3.
call "D:\VS\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 || exit /b 1
set "PATH=C:\Program Files\CMake\bin;%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe;%PATH%"
cd /d D:\tools\aseprite || exit /b 1
if not exist build mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DLAF_BACKEND=skia -DSKIA_DIR=D:\tools\skia -DSKIA_LIBRARY_DIR=D:\tools\skia\out\Release-x64 -DSKIA_LIBRARY=D:\tools\skia\out\Release-x64\skia.lib -G Ninja .. || exit /b 1
ninja aseprite || exit /b 1
echo.
echo BUILD_OK: D:\tools\aseprite\build\bin\aseprite.exe
