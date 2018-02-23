/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
'use strict';

const path = require('path'),
	fs = require('fs'),
	chalk = require('chalk'),
	blockgen = require('./block'),
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

function addImport (state, name, obj) {
	if (name === 'NSObject') {
		obj = obj || {};
		obj.framework = 'Foundation';
	}
	if (!name || !obj || name === state.class.name) {
		return;
	}
	state.imports[name] = obj;
	state.frameworks && (state.frameworks[obj.framework] = 1);
}

function isSpecialNumber (cls) {
	return cls.indexOf('float') !== -1 || cls.indexOf('ext_vector_type') > 0;
}

function isBlock (cls) {
	return cls.indexOf('(^)') > 0;
}

function isFunctionPointer (cls) {
	return cls.indexOf('(*)') > 0;
}

function isStructEncoding (encoding) {
	return encoding && encoding.charAt(0) === '{';
}

function isPointerEncoding (encoding) {
	return encoding && ((encoding.charAt(0) === '(' && encoding.indexOf('^') > 0) || encoding.charAt(0) === '^');
}

// used by util.getResultWrapper()
function getStructNameFromEncoding (encoding) {
	if (encoding && encoding.charAt(0) === '{') {
		var i = encoding.indexOf('=');
		return encoding.substring(1, i).replace(/^_+/, '').trim();
	}
}

function isProtocol (value) {
	return (value.indexOf('<') > 0) && !isBlock(value);
}

function getProtocolClass (value) {
	var i = value.indexOf('<');
	var name = value.substring(0, i).trim();
	if (name === 'id') {
		return 'NSObject';
	} else {
		return name;
	}
}

function newPrefix (state, cls, noimport) {
	if (state.class.name === cls || noimport) {
		return 'new ' + cls + '(';
	} else {
		return 'new $imports.' + cls + '(';
	}
}

function cleanupClassName(name) {
	return name.replace(/\*/g, '').trim();
}

function getResultWrapper(state, json, obj, instance) {
	var type = obj.type && obj.type.type || obj.type,
		value = obj.type && obj.type.value || obj.value || type,
		name = obj.name || value,
		struct,
		typedef;
	// console.log('>', name, type, value);
	switch (type) {
		case 'unexposed':
		case 'obj_interface':
		case 'objc_interface':
		case 'objc_pointer': {
			var cls = cleanupClassName(value);
			if (cls === 'instancetype' && instance) {
				return newPrefix(state, 'this.constructor', true);
			}
			if (cls === 'instancetype' || cls === state.class.name) {
				let varname = 'this';
				if (instance) {
					varname += '.constructor';
				}
				return newPrefix(state, varname, true);
			}
			if (cls in json.classes) {
				addImport(state, cls, json.classes[cls]);
				return newPrefix(state, cls);
			} else if (cls === 'id') {
				addImport(state, 'NSObject', json.classes.NSObject);
				return newPrefix(state, 'NSObject');
			} else if (isProtocol(cls)) {
				cls = getProtocolClass(cls);
				addImport(state, cls, json.classes[cls]);
				return newPrefix(state, cls);
			} else if (cls === 'SEL') {
				return '';
			} else if (cls === 'Class') {
				return '';
			} else if (isPrimitive(cls)) {
				return '';
			} else if (isSpecialNumber(cls)) {
				return '';
			} else if (cls === 'void') {
				return '';
			} else if (isBlock(value)) {
				// FIXME:
				return '';
			} else if (isFunctionPointer(value)) {
				// FIXME:
				return '';
			} else if (isPointerEncoding(obj.encoding)) {
				return '';
			} else if (isStructEncoding(obj.encoding)) {
				struct = json.structs[name];
				addImport(state, name, struct);
				return newPrefix(state, name);
			} else {
				if (json.typedefs) {
					typedef = json.typedefs[cls];
				}
				if (typedef) {
					return getResultWrapper(state, json, typedef, instance);
				}
				if (obj.encoding === '*' || obj.encoding === 'r^v' || obj.encoding === 'r*' || /^r\^/.test(obj.encoding)) {
					// void pointer
					return '';
				}
				// see if it's a typedef to a class
				if (value.indexOf(' *') > 0) {
					cls = value.substring(0, value.indexOf('*')).trim();
					if (cls in json.classes) {
						addImport(state, cls, json.classes[cls]);
						return newPrefix(state, cls);
					}
				}
				// generate object type
				if (value === 'ObjectType' || value === 'objc_pointer' || value === 'ValueType') {
					cls = 'NSObject';
					addImport(state, cls, json.classes[cls]);
					return newPrefix(state, cls);
				}
				logger.warn('couldn\'t find class', value, JSON.stringify(obj));
				cls = 'NSObject';
				addImport(state, cls, json.classes[cls]);
				return newPrefix(state, cls);
			}
		}
		case 'id': {
			addImport(state, 'NSObject', json.classes.NSObject);
			return newPrefix(state, 'NSObject');
		}
		case 'incomplete_array':
		case 'vector':
		case 'pointer':
		case 'SEL': {
			return '';
		}
		case 'struct': {
			name = getStructNameFromEncoding(obj.encoding) || name;
			if (name === '?') {
				// TODO:
				return '';
			}
			struct = json.structs[name];
			addImport(state, name, struct);
			return newPrefix(state, name);
		}
		case 'enum': {
			return '';
		}
		case 'union': {
			// FIXME: not currently handled
			return '';
		}
		case 'record': {
			if (value.indexOf('struct ') === 0) {
				name = value.substring(7).replace(/^_+/, '').trim();
				struct = json.structs[name];
				if (struct) {
					// console.log('!!struct resolved to', struct);
					addImport(state, name, struct);
					return newPrefix(state, name);
				} else {
					logger.warn('Couldn\'t resolve struct:', value);
				}
			}
			if (value.indexOf('union ') === 0) {
				return '';
			}
			break;
		}
		case 'Class': {
			return '';
		}
		case 'typedef': {
			if (isPrimitive(value)) {
				return '';
			}
			typedef = json.typedefs[value];
			if (typedef) {
				// console.log('!!typedef resolved to', typedef);
				return getResultWrapper(state, json, typedef, instance);
			} else {
				logger.warn('Couldn\'t resolve typedef:', value);
			}
			break;
		}
		case 'block': {
			// FIXME: not yet implemented
			return '';
		}
		case 'function_callback': {
			// FIXME: not yet implemented
			return '';
		}
		case 'unknown': {
			return '';
		}
		case 'void': {
			return '';
		}
		default: {
			if (isPrimitive(type) || value.indexOf('*') > 0) {
				return '';
			}
		}
	}
	logger.warn('Not sure how to handle: name=', name, 'type=', type, 'value=', value);
	return '';
}

/**
 * Repeats a given character n times and returns the generated string
 * @param  {string} ch character (or string) to repeat
 * @param  {number} n  number of times to repeat
 * @return {string}
 */
function repeat(ch, n) {
	return new Array(n).join(ch);
}

function generateArgList(state, json, args, startParens, endParens, def) {
	if (args && args.length) {
		var result = startParens;
		var found = {};
		result += args.map(function (arg, index) {
			// add underscore to ensure that JS reserved words (like arguments) aren't generated
			var name = '_' + (arg.isBlock ? arg.blockname : arg.name);
			// metabase will in rare cases have the same name for multiple args
			if (name in found) {
				name += '_' + index;
			}
			found[name] = 1;
			return name;
		}).join(', ');
		return result + endParens;
	}
	return def;
}

function toValue (encoding, type) {
	switch (encoding) {
		case 'd':
			return 'doubleValue';
		case 'i':
			return 'intValue';
		case 'l':
			return 'longValue';
		case 'f':
			return 'floatValue';
		case 'q':
			return 'longLongValue';
		case 'c':
			return 'charValue';
		case 's':
			return 'shortValue';
		case 'B':
			return 'boolValue';
		case 'L':
			return 'unsignedLongValue';
		case 'Q':
			return 'unsignedLongLongValue';
		case 'I':
			return 'unsignedIntValue';
		case 'C':
			return 'unsignedCharValue';
		case 'S':
			return 'unsignedShortValue';
	}
	logger.error('Can\'t convert encoding: ' + encoding + ', type: ' + type);
	process.exit(1);
}

function toValueDefault(encoding, type) {
	switch (encoding) {
		case 'd':
		case 'i':
		case 'l':
		case 'f':
		case 's':
		case 'L':
		case 'Q':
		case 'q':
		case 'I':
		case 'S':
			return '0';
		case 'C':
		case 'c':
			return '\'\\0\'';
		case 'B':
			return 'NO';
		case '@':
		case ':':
		case '#':
		case '^':
			return 'nil';
	}
	logger.error('Can\'t convert encoding: ' + encoding + ', type: ' + type);
	process.exit(1);
}

/**
 * [getObjCReturnResult description]
 * @param  {object} json metabase
 * @param  {object} value     [description]
 * @param  {string} value.filename     [description]
 * @param  {string} value.framework     [description]
 * @param  {string} value.type     [description]
 * @param  {string} value.value     [description]
 * @param  {string} name      [description]
 * @param  {string} returns   [description]
 * @param  {boolean} asPointer [description]
 * @return {string}           [description]
 */
function getObjCReturnResult(json, value, name, returns, asPointer) {
	if (value.type === 'typedef') {
		const typedef = json.typedefs[value.value];
		if (!typedef) {
			throw new Error('Was unable to find typedef in metabase: ' + value.value);
		}
		return getObjCReturnResult(json, typedef, name, returns, asPointer);
	}
	name = name || 'result$';
	returns = returns || 'return';
	asPointer = asPointer === undefined ? '&' : asPointer;
	switch (value.type) {
		case 'unknown':
		case 'union':
		case 'unexposed':
		case 'vector':
		case 'incomplete_array':
		case 'pointer': {
			return returns + ' (' + name + ' == nil) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(const void *)' + asPointer + name + ' encoding:@encode(' + value.value + ')];';
		}
		case 'enum': {
			return returns + ' @(' + name + ');';
		}
		case 'struct': {
			if (value.framework && value.filename) {
				const fn = path.basename(value.filename).replace(/\.h$/, '');
				return returns + ' [HyperloopPointer pointer:(const void *)' + asPointer + name + ' encoding:@encode(' + value.value + ') framework:@"' + value.framework + '" classname:@"' + fn + '"];';
			}
			return returns + ' [HyperloopPointer pointer:(const void *)' + asPointer + name + ' encoding:@encode(' + value.value + ')];';
		}
		case 'record': {
			if (!value.value) {
				return returns + ' (' + name + ' == nil) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(const void *)' + name + ' encoding:@encode(void *)];';
			}
			// How do we handle a case where the value is "struct CGAffineTransform"?
			if (value.value.indexOf('struct ') === 0) {
				const structName = value.value.substring(7).replace(/^_+/, '').trim();
				const struct = json.structs[structName];
				if (!struct) {
					throw new Error('Unable to find struct in metabase: ' + structName);
				}
				return getObjCReturnResult(json, {
					filename: value.filename,
					framework: value.framework,
					type: 'struct',
					value: structName
				}, name, returns, asPointer);
			}
			break;
		}
		case 'id':
		case 'objc_interface':
		case 'obj_interface':
		case 'objc_pointer': {
			if (value.framework && value.filename) {
				const fn = path.basename(value.filename).replace(/\.h$/, '');
				return returns + ' (' + name + ' == nil || [(id)' + name + ' isEqual:[NSNull null]]) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(__bridge void *)' + name + ' encoding:@encode(id) framework:@"' + value.framework + '" classname:@"' + fn + '"];';
			}
			return returns + ' (' + name + ' == nil || [(id)' + name + ' isEqual:[NSNull null]]) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(__bridge void *)' + name + ' encoding:@encode(id)];';
		}
		case 'Class': {
			if (value.framework && value.filename) {
				const fn = path.basename(value.filename).replace(/\.h$/, '');
				return returns + ' (' + name + ' == nil || [(id)' + name + ' isEqual:[NSNull null]]) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(__bridge void *)' + name + ' encoding:@encode(Class) framework:@"' + value.framework + '" classname:@" ' + fn + '"];';
			}
			return returns + ' (' + name + ' == nil || [(id)' + name + ' isEqual:[NSNull null]]) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(__bridge void *)' + name + ' encoding:@encode(Class)];';
		}
		case 'SEL': {
			return returns + ' (' + name + ' == nil) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(__bridge void *)' + asPointer + name + ' encoding:@encode(SEL)];';
		}
		case 'void': {
			return returns + ' nil;';
		}
		case 'block': {
			return returns + ' (' + name + ' == nil) ? (id)[NSNull null] : (id)[HyperloopPointer pointer:(__bridge void *)' + asPointer + name + ' encoding:"' + value.encoding + '"];';
		}
	}
	if (isPrimitive(value.type)) {
		switch (value.encoding) {
			case 'd':
				return returns + ' [NSNumber numberWithDouble:' + name + '];';
			case 'i':
				return returns + ' [NSNumber numberWithInt:' + name + '];';
			case 'l':
				return returns + ' [NSNumber numberWithLong:' + name + '];';
			case 'f':
				return returns + ' [NSNumber numberWithFloat:' + name + '];';
			case 'q':
				return returns + ' [NSNumber numberWithLongLong:' + name + '];';
			case 'c':
				return returns + ' [NSNumber numberWithChar:' + name + '];';
			case 's':
				return returns + ' [NSNumber numberWithShort:' + name + '];';
			case 'B':
				return returns + ' [NSNumber numberWithBool:' + name + '];';
			case 'L':
				return returns + ' [NSNumber numberWithUnsignedLong:' + name + '];';
			case 'Q':
				return returns + ' [NSNumber numberWithUnsignedLongLong:' + name + '];';
			case 'I':
				return returns + ' [NSNumber numberWithUnsignedInt:' + name + '];';
			case 'C':
				return returns + ' [NSNumber numberWithUnsignedChar:' + name + '];';
			case 'S':
				return returns + ' [NSNumber numberWithUnsignedShort:' + name + '];';
			case '*':
				return returns + ' [NSString stringWithUTF8String:' + name + '];';
		}
	}
	throw new Error('cannot figure out objc return result: ' + JSON.stringify(value));
	// console.log(value);
	// logger.error('cannot figure out objc return result', value);
	// process.exit(1);
}

function generatePropGetter (state, json, prop, name) {
	var wrapper = getResultWrapper(state, json, prop, true);
	var endsep = wrapper ? ')' : '';
	name = name || 'this.$native';
	return  '\tget: function () {\n'
			+ repeat('\t', 5) + 'if (!$init) { $initialize(); }\n'
			+ repeat('\t', 5) + 'return ' + wrapper + '$dispatch(' + name + ', \'' + (prop.selector || prop.name) + '\')' + endsep + ';\n'
			+ repeat('\t', 4) + '}';
}

function generateSetterSelector (name) {
	return 'set' + name.charAt(0).toUpperCase() + name.substring(1) + ':';
}

function generatePropSetter (state, json, prop, name) {
	name = name || 'this.$native';
	return  'set: function (_' + prop.name + ') {\n'
			+ repeat('\t', 5) + 'if (!$init) { $initialize(); }\n'
			+ repeat('\t', 5) + 'this.$private.' + prop.name + ' = _' + prop.name + ';\n'
			+ repeat('\t', 5) + '$dispatch(' + name + ', \'' + generateSetterSelector(prop.name) + '\', _' + prop.name + ');\n'
			+ repeat('\t', 4) + '}';
}

function generateProp (state, json, prop, readonly, name) {
	var result = { name: prop.name };
	result.getter = generatePropGetter(state, json, prop, name);
	if (!readonly && (!prop.attributes || prop.attributes.indexOf('readonly') < 0)) {
		var sep = repeat('\t', 4);
		result.setter = '\n' + sep + generatePropSetter(state, json, prop, name);
	}
	return result;
}

function getPrimitiveValue (type) {
	switch (type) {
		case 'ulong':
			return 'unsigned long';
		case 'uint':
			return 'unsigned int';
		case 'ushort':
			return 'unsigned short';
		case 'uchar':
			return 'unsigned char';
		case 'long_long':
			return 'long long';
		case 'ulonglong':
			return 'unsigned long long';
		case 'enum':
			return 'int';
	}
	return type;
}

function isCharStarPointer (obj) {
	return obj.type === 'pointer' && obj.value === 'char *'
		|| obj.type === 'char *';
}

function isCharStarStarPointer (obj) {
	return obj.type === 'pointer' && obj.value === 'char **';
}

function isObject (obj) {
	return obj.type === 'objc_pointer' || obj.type === 'obj_interface' || obj.type === 'id';
}

/**
 * [generateObjCValue description]
 * @param  {[type]}   state   [description]
 * @param  {object}   json    metabase
 * @param  {[type]} fn      [description]
 * @param  {object}   arg     [description]
 * @param  {string}   arg.encoding     [description]
 * @param  {string}   arg.type     [description]
 * @param  {string}   arg.value     [description]
 * @param  {string}   name    [description]
 * @param  {boolean}   define  [description]
 * @param  {string}   tab     [description]
 * @param  {[type]}   arglist [description]
 * @return {string}           [description]
 */
// Calls itself recursively
// Called by util.generateObjCArgument()
// Called by custom.generateMethod()
function generateObjCValue(state, json, fn, arg, name, define, tab, arglist) {
	const code = [];
	tab = tab || '';
	arglist = arglist || [];
	define = define === undefined ? true : define;
	if (arg.type === 'typedef') {
		const typedef = json.typedefs[arg.value];
		if (!typedef) {
			throw new Error(`Unable to find typedef in metabase: ${arg.value}`);
		}
		return generateObjCValue(state, json, fn, typedef, name, define, tab, arglist);
	} else if (isPrimitive(arg.encoding)) {
		const type = getPrimitiveValue(arg.type);
		arglist.push('(' + type + ') ' + name);
		code.push('\t' + (define ? type + ' ' : '') + name + ' = [' + name + '_ isEqual:[NSNull null]] ? ' + toValueDefault(arg.encoding, arg.type) + ' : [' + name + '_ ' + toValue(arg.encoding, arg.type) + '];');
	} else if (arg.type === 'struct' || arg.type === 'pointer' || arg.type === 'char *') {
		if (isCharStarPointer(arg)) {
			code.push('\t' + (define ? arg.value + ' ' : '') + name + ' = (' + arg.value + ')[[' + name + '_ stringValue] UTF8String];');
		} else if (isCharStarStarPointer(arg)) {
			code.push('\t' + (define ? arg.value + ' ' : '') + name + ' = (' + arg.value + ')[(HyperloopPointer *)' + name + '_ pointerValue];');
		} else {
			code.push('\t' + (define ? arg.value + ' ' : '') + name + ' = *(' + arg.value + '*)[(HyperloopPointer *)' + name + '_ pointerValue];');
		}
		arglist.push('(' + arg.value + ') ' + name);
	} else if (arg.type === 'constant_array') {
		const ii = arg.value.indexOf('[');
		let n;
		if (ii < 0) {
			n = arg.value;
			arglist.push('(' + n + ') ' + name);
		} else {
			n = arg.value.substring(0, ii).trim();
			arglist.push('(' + n + ' *) ' + name);
		}
		code.push('\t' + (define ? n + ' *' : '') + name + ' = (' + n + '*)[(HyperloopPointer *)' + name + '_ pointerValue];');
	} else if (arg.type === 'incomplete_array') {
		const n = 'void **';
		arglist.push('(' + n + ') ' + name);
		code.push('\t' + (define ? n + ' *' : '') + name + ' = (' + n + '*)[(HyperloopPointer *)' + name + '_ pointerValue];');
	} else if (arg.type === 'objc_pointer' || arg.type === 'id' || arg.type === 'objc_interface') {
		const n = arg.value;
		code.push('\t' + (define ? n + ' ' : '') + name + ' = (' + n + ')[(HyperloopPointer *)' + name + '_ objectValue];');
		arglist.push('(' + n + ') ' + name);
	} else if (arg.type === 'Class' || arg.encoding === '#') {
		const n = arg.value;
		code.push('\t' + (define ? n + ' ' : '') + name + ' = (' + n + ')[(HyperloopPointer *)' + name + '_ classValue];');
		arglist.push('(' + n + ') ' + name);
	} else if (arg.type === 'SEL' || arg.encoding === ':') {
		const n = arg.value;
		code.push('\t' + (define ? n + ' ' : '') + name + ' = (' + n + ')[(HyperloopPointer *)' + name + '_ selectorValue];');
		arglist.push('(' + n + ') ' + name);
	} else if (arg.type === 'block') {
		const block = blockgen.findBlock(json, arg.value, fn.framework);
		const js = blockgen.generateBlockCallback(state, json, block, arg, '\t', define);
		code.push(js);
		arglist.push('(' + arg.value + ') ' + name);
	} else if (arg.encoding.charAt(0) === '^') {
		const n = arg.value;
		arglist.push('(' + n + ') ' + name);
		code.push('\t' + name + ' = (' + n + ')[(HyperloopPointer *)' + name + '_ pointerValue];');
	} else {
		let found = false;
		if (arg.type === 'record') {
			let structName = arg.value;
			if (arg.value.indexOf('struct ') === 0) {
				structName = arg.value.substring(7).replace(/^_+/, '').trim();
			}
			const struct = json.structs[structName];
			if (!struct) {
				throw new Error(`Unable to find struct in metabase: ${structName}`);
			}
			// recursively call
			return generateObjCValue(state, json, fn, {
				encoding: arg.encoding,
				type: 'struct',
				value: struct.name
			}, name, define, tab, arglist);
		} else if (/(union|vector|unexposed)/.test(arg.type)) {
			const n = arg.value;
			arglist.push('(' + n + ') ' + name);
			code.push('\t' + name + ' = (' + n + ')[(HyperloopPointer *)' + name + '_ pointerValue];');
			found = true;
		}
		if (!found) {
			throw new Error(`don't know how to encode: ${JSON.stringify(arg)}`);
			// logger.error('don\'t know how to encode:', arg);
			// process.exit(1);
		}
	}
	return code.join('\n');
}

function isObjectType (type, encoding) {
	switch (type) {
		case 'obj_interface':
		case 'objc_pointer':
		case 'Class':
		case 'class':
		case 'id':
			return true;
		default: break;
	}
	if (encoding && (encoding.charAt(0) === '@' || encoding.charAt(0) === '#')) {
		return true;
	}
	return false;
}

function createLogger(log, level) {
	log[level] && (logger[level] = function () {
		var args = Array.prototype.slice.call(arguments);
		log[level].call(log, chalk.magenta.inverse('[Hyperloop]') + ' ' + args.join(' '));
	});
}

function setLog (logFn) {
	[ 'info', 'debug', 'warn', 'error', 'trace' ].forEach(function (level) {
		createLogger(logFn, level);
	});
}

function generateSafeSymbol(signature) {
	return signature.replace(/[\s^()\\<\\>*:+,]/g, '_');
}

function camelCase (string) {
	return string.replace(/^([A-Z])|[\s-_:](\w)/g, function (match, p1, p2) {
		if (p2) {
			return p2.toUpperCase();
		}
		return p1.toLowerCase();
	}).replace(/:/g, '');
}

/**
 * Gets a mapping of all classes and their properties that are affected by
 * the UIKIT_DEFINE_AS_PROPERTIES or FOUNDATION_SWIFT_SDK_EPOCH_AT_LEAST
 * macros.
 *
 * UIKIT_DEFINE_AS_PROPERTIES and FOUNDATION_SWIFT_SDK_EPOCH_AT_LEAST introduce
 * new readonly properties in favor of methods with the same name. This changes
 * how one would access them in Hyperloop.
 *
 * For example:
 *
 *  // < Hyperloop 2.0.0, as method
 *  var color = UIColor.redColor();
 *  // >= Hyperloop 2.0.0, as property (note the missing parenthesis)
 *  var color = UIColor.redColor;
 *
 * @return {Object} Contains a mapping of class names and their affected properties
 */
function getMethodTableForMigration() {
	var migrationFilename = 'migration-20161014143619.json';

	if (getMethodTableForMigration.cachedTable) {
		return getMethodTableForMigration.cachedTable;
	}

	var migrationPathAndFilename = path.resolve(__dirname, path.join('../../data', migrationFilename));
	if (fs.existsSync(migrationPathAndFilename)) {
		getMethodTableForMigration.cachedTable = JSON.parse(fs.readFileSync(migrationPathAndFilename).toString());
	} else {
		getMethodTableForMigration.cachedTable = {};
	}

	return getMethodTableForMigration.cachedTable;
}

exports.repeat = repeat;
exports.generateProp = generateProp;
exports.generateSetterSelector = generateSetterSelector;
exports.generateArgList = generateArgList;
exports.setLog = setLog;
exports.getObjCReturnResult = getObjCReturnResult;
exports.getProtocolClass = getProtocolClass;
exports.isProtocol = isProtocol;
exports.isObjectType = isObjectType;
exports.generateSafeSymbol = generateSafeSymbol;
exports.generateObjCValue = generateObjCValue;
exports.camelCase = camelCase;
exports.toValueDefault = toValueDefault;
exports.isPrimitive = isPrimitive;
exports.getPrimitiveValue = getPrimitiveValue;
exports.getMethodTableForMigration = getMethodTableForMigration;
exports.getResultWrapper = getResultWrapper;
exports.getStructNameFromEncoding = getStructNameFromEncoding;

Object.defineProperty(exports, 'logger', {
	get: function () {
		return logger;
	}
});
