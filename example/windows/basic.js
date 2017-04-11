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

/*
 * Enum values
 */
var CreationCollisionOption = require('Windows.Storage.CreationCollisionOption');
var ReplaceExisting = CreationCollisionOption.ReplaceExisting;

/*
 * Async operations with Promises
 */
var PathIO = require('Windows.Storage.PathIO'),
    ApplicationData = require('Windows.Storage.ApplicationData'),
	CreationCollisionOption = require('Windows.Storage.CreationCollisionOption');

Ti.API.info('ApplicationData.Current.LocalFolder.Path = ' + ApplicationData.Current.LocalFolder.Path);

ApplicationData.Current.LocalFolder.CreateFileAsync("test.txt", CreationCollisionOption.ReplaceExisting)
    .then(function () {
        return PathIO.WriteTextAsync('ms-appdata:///local/test.txt', 'Lorem ipsum dolor sit amet');
    })
    .then(function () {
        return PathIO.ReadTextAsync('ms-appdata:///local/test.txt');
    }).
    then(function (content) {
        alert(content);
    }, function (err) {
        alert(err);
    });

