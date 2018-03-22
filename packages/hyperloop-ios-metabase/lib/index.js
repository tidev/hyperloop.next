/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

// be very specific about what we want as publicly exported APIs
exports.setLogger = require('./util').setLog;
exports.unifiedMetabase = require('./metabase').unifiedMetabase;
exports.userFrameworks = require('./user_frameworks').getUserFrameworks;
exports.ModuleMetadata = require('./module_metadata').ModuleMetadata;
exports.SDKEnvironment = require('./sdk').SDKEnvironment;

// TODO Try to limit what we expose in these as well:
exports.swift = require('./swift');
exports.cocoapods = require('./cocoapods');
exports.resources = require('./resources');
