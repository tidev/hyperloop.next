mkdir Windows10.Win32
cd Windows10.Win32
cmake.exe -G "Visual Studio 14 2015" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_SYSTEM_NAME=WindowsStore -DCMAKE_SYSTEM_VERSION=10.0 ..
cd ..
mkdir Windows10.ARM
cd Windows10.ARM
cmake.exe -G "Visual Studio 14 2015 ARM" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_SYSTEM_NAME=WindowsStore -DCMAKE_SYSTEM_VERSION=10.0 ..
cd ..
mkdir WindowsPhone.ARM
cd WindowsPhone.ARM
cmake.exe -G "Visual Studio 14 2015 ARM" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_SYSTEM_NAME=WindowsPhone -DCMAKE_SYSTEM_VERSION=8.1 ..
cd ..
mkdir WindowsPhone.Win32
cd WindowsPhone.Win32
cmake.exe -G "Visual Studio 14 2015" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_SYSTEM_NAME=WindowsPhone -DCMAKE_SYSTEM_VERSION=8.1 ..
cd ..
mkdir WindowsStore.Win32
cd WindowsStore.Win32
cmake.exe -G "Visual Studio 14 2015" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_SYSTEM_NAME=WindowsStore -DCMAKE_SYSTEM_VERSION=8.1 ..
appc ti build -p windows --build-only -l trace
