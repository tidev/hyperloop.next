# Titanium Windows Native Module - hyperloop
#
# Copyright (c) 2016 by Appcelerator, Inc. All Rights Reserved.
# Licensed under the terms of the Apache Public License.
# Please see the LICENSE included with this distribution for details.

cmake_minimum_required(VERSION 3.0.0)

if(${CMAKE_SYSTEM_NAME} STREQUAL "Windows10")
  set(PLATFORM win10)
elseif(${CMAKE_SYSTEM_NAME} STREQUAL "WindowsPhone")
  set(PLATFORM phone)
  add_definitions("-DPHONE")
elseif(${CMAKE_SYSTEM_NAME} STREQUAL "WindowsStore")
  set(PLATFORM store)
else()
  message(FATAL_ERROR "This app supports Store / Phone only.")
endif()

project(Hyperloop)

set(Hyperloop_VERSION 0.1.0)

set(WINDOWS_SOURCE_DIR "C:/ProgramData/Titanium/mobilesdk/win32/6.1.0.v20161019130507/windows")

SET(CMAKE_FIND_LIBRARY_PREFIXES "")
SET(CMAKE_FIND_LIBRARY_SUFFIXES ".lib" ".dll")

set(CMAKE_INCLUDE_CURRENT_DIR ON)
set(CMAKE_INCLUDE_CURRENT_DIR_IN_INTERFACE ON)

set(Ti_ARCH "x86")
if(CMAKE_GENERATOR MATCHES "^Visual Studio .+ ARM$")
  set(Ti_ARCH "arm")
endif()

set_property(GLOBAL PROPERTY USE_FOLDERS ON)

get_filename_component(APPCELERATOR_CMAKE_MODULE_PATH ${PROJECT_SOURCE_DIR}/cmake ABSOLUTE)
list(INSERT CMAKE_MODULE_PATH 0 ${APPCELERATOR_CMAKE_MODULE_PATH})

find_package(HAL REQUIRED)
find_package(TitaniumKit REQUIRED)
find_package(TitaniumWindows_Utility REQUIRED)

set(SOURCE_Hyperloop
  include/Hyperloop.hpp
  src/Hyperloop.cpp
  )

source_group(Hyperloop FILES ${SOURCE_Hyperloop})

set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN 1)

add_library(Hyperloop SHARED
  ${SOURCE_Hyperloop}
  )

include(GenerateExportHeader)
generate_export_header(Hyperloop)
target_compile_definitions(Hyperloop PRIVATE Hyperloop_EXPORTS)

target_include_directories(Hyperloop PUBLIC
  ${PROJECT_SOURCE_DIR}/include
  $<TARGET_PROPERTY:HAL,INTERFACE_INCLUDE_DIRECTORIES>
  $<TARGET_PROPERTY:TitaniumKit,INTERFACE_INCLUDE_DIRECTORIES>
  $<TARGET_PROPERTY:TitaniumWindows_Utility,INTERFACE_INCLUDE_DIRECTORIES>
  )

target_link_libraries(Hyperloop
  HAL
  TitaniumKit
  TitaniumWindows_Utility
  )

set_target_properties(Hyperloop PROPERTIES VS_WINRT_COMPONENT TRUE)

set_property(TARGET Hyperloop APPEND_STRING PROPERTY LINK_FLAGS_DEBUG "/OPT:NOREF /OPT:NOICF")

set_property(TARGET Hyperloop PROPERTY VERSION ${Hyperloop_VERSION})
set_property(TARGET Hyperloop PROPERTY SOVERSION 0)
set_property(TARGET Hyperloop PROPERTY INTERFACE_Hyperloop_MAJOR_VERSION 0)
set_property(TARGET Hyperloop APPEND PROPERTY
  COMPATIBLE_INTERFACE_STRING Hyperloop_MAJOR_VERSION
  )

set_property(TARGET Hyperloop PROPERTY VS_WINRT_REFERENCES
  "${WINDOWS_SOURCE_DIR}/templates/build/TitaniumWindows_Hyperloop/bin/${PLATFORM}/${CMAKE_BUILD_TYPE}/TitaniumWindows_Hyperloop.winmd"
  "${PROJECT_SOURCE_DIR}/reflection/HyperloopInvocation/bin/${PLATFORM}/${CMAKE_BUILD_TYPE}/HyperloopInvocation.winmd"
)

install(TARGETS Hyperloop EXPORT Hyperloop_Targets
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
  RUNTIME DESTINATION bin
  INCLUDES DESTINATION include
  )

export(EXPORT Hyperloop_Targets
  FILE "${CMAKE_BINARY_DIR}/Hyperloop_Targets.cmake"
)

configure_file(cmake/Hyperloop_Config.cmake
  "${CMAKE_BINARY_DIR}/Hyperloop_Config.cmake"
  COPYONLY
  )

include(CMakePackageConfigHelpers)
write_basic_package_version_file(
  "${CMAKE_BINARY_DIR}/Hyperloop_ConfigVersion.cmake"
  VERSION ${Hyperloop_VERSION}
  COMPATIBILITY AnyNewerVersion
  )

export(PACKAGE Hyperloop)