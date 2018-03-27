/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

// be very specific about what we want as publicly exported APIs
exports.setLogger = require('./util').setLog;
exports.unifiedMetabase = require('./metabase').unifiedMetabase;
exports.userFrameworks = require('./user_frameworks').getUserFrameworks;
exports.thirdPartyFrameworks = require('./third_party_frameworks').getThirdPartyFrameworks;
exports.SDKEnvironment = require('./sdk').SDKEnvironment;
exports.swift = {
	getVersion: require('./swift').getVersion,
	generateSwiftMangledClassName: require('./swift').generateSwiftMangledClassName
};
exports.cocoapods = require('./cocoapods');
exports.resources = require('./resources');
