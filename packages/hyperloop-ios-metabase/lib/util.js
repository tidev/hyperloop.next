/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const chalk = require('chalk'),
	crypto = require('crypto'),
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
		const args = Array.prototype.slice.call(arguments);
		log[level].call(log, chalk.magenta.inverse('[Hyperloop]') + ' ' + args.join(' '));
	});
}

function setLog (logFn) {
	[ 'info', 'debug', 'warn', 'error', 'trace' ].forEach(function (level) {
		createLogger(logFn, level);
	});
}

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

/**
 * Creates a MD5 hash from the given string data.
 *
 * @param {String} data Data the hash will be generated for
 * @return {String} The generated MD5 hash
 */
function createHashFromString(data) {
	return crypto.createHash('md5').update(data).digest('hex');
}

Object.defineProperty(exports, 'logger', {
	get: function () {
		return logger;
	}
});

/**
 * Adds a green prefix to any output from a child process.
 * @param {String} prefix prefix string to prepend to output
 * @param {ChildProcess} obj process
 * @param {Function} fn callback function
 * @returns {void}
 */
function prefixOutput(prefix, obj, fn) {
	return (function () {
		let cur = '';
		obj.on('data', function (buf) {
			cur += buf;
			if (cur.charAt(cur.length - 1) === '\n') {
				cur.split(/\n/).forEach(function (line) {
					line && fn(chalk.green(prefix) + ' ' + line);
				});
				cur = '';
			}
		});
		obj.on('exit', function () {
			// flush
			if (cur) {
				cur.split(/\n/).forEach(function (line) {
					line && fn(chalk.green(prefix) + ' ' + line);
				});
			}
		});
	}());
}

exports.prefixOutput = prefixOutput;
exports.setLog = setLog;
exports.isPrimitive = isPrimitive;
exports.createHashFromString = createHashFromString;
