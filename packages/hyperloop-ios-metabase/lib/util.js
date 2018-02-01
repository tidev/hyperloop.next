/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
var chalk = require('chalk'),
	logger = {
		info: function () {
			console.log.apply(console, arguments);
		},
		debug: function () {
			console.log.apply(console, arguments);
		},
		trace: function () {
			console.log.apply(console, arguments);
		},
		warn: function () {
			console.log.apply(console, arguments);
		},
		error: function () {
			console.error.apply(console, arguments);
		}
	};


function createLogger(log, level) {
	log[level] && (logger[level] = function () {
		var args = Array.prototype.slice.call(arguments);
		log[level].call(log, chalk.magenta.inverse('[Hyperloop]') + ' ' + args.join(' '));
	});
}

function setLog (logFn) {
	['info','debug','warn','error','trace'].forEach(function (level) {
		createLogger(logFn, level);
	});
}

exports.setLog = setLog;

Object.defineProperty(exports, 'logger', {
	get: function () {
		return logger;
	}
});


function isPrimitive(type) {
	switch (type) {
		case 'i':
		case 'c':
		case 'd':
		case 'f':
		case 'B':
		case 's':
		case 'l':
		case 'q':
		case 'L':
		case 'Q':
		case 'I':
		case 'S':
		case 'C':
		case 'int':
		case 'uint':
		case 'unsigned int':
		case 'long':
		case 'ulong':
		case 'unsigned long':
		case 'ulonglong':
		case 'unsigned long long':
		case 'long long':
		case 'long_long':
		case 'double':
		case 'short':
		case 'ushort':
		case 'unsigned short':
		case 'float':
		case 'bool':
		case 'uchar':
		case 'unsigned char':
		case 'char':
		case 'char_s':
		case 'constant_array':
			return true;
	}
	return false;
}
exports.isPrimitive = isPrimitive;
