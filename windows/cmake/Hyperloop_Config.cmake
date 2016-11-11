# Titanium Windows Native Module - hyperloop
#
# Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
# Licensed under the terms of the Apache Public License.
# Please see the LICENSE included with this distribution for details.

include(CMakeFindDependencyMacro)
find_dependency(HAL)
find_dependency(TitaniumKit)

include("${CMAKE_BINARY_DIR}/TitaniumWindows_TitaniumHyperloop_Targets.cmake")