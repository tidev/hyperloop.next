/**
 * Basic Hyperloop Module example for Windows
 *
 * Copyright (c) 2016 by Appcelerator, Inc. and subject to the
 * Appcelerator Platform Subscription agreement.
 */

/*
 * Instance method call
 * 
 * In C#:
 *
 * var object = new System.Object();
 * object.GetHashCode();
 *
 */
var System_Object = require('System.Object');
var object = new System_Object();
Ti.API.info(object.GetHashCode());

/*
 * Static method call with arguments
 *
 * In C#:
 *
 * System.Math.Abs(-1.23);
 *
 */
var System_Math = require('System.Math');
Ti.API.info(System_Math.Abs(-1.23));

/*
 *
 * Static property
 * 
 * Note: Following example does not compile on Windows 8.1 Store App
 * because it doesn't support Windows.System.MemoryManager
 *
 * In C#:
 *
 * // Gets the app's memory usage limit
 * Windows.System.MemoryManager.AppMemoryUsageLimit;
 * 
 * // Gets the app's current memory usage
 * Windows.System.MemoryManager.AppMemoryUsage;
 *
 */
var MemoryManager = require('Windows.System.MemoryManager');
var appMemoryUsageLimit = MemoryManager.AppMemoryUsageLimit;
var appMemoryUsage      = MemoryManager.AppMemoryUsage;

