/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';
const utillib = require('./util');
const classgen = require('./class');
const babelParser = require('@babel/parser');
const t = require('@babel/types');
const generate = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;

function Parser() {
}

function ParserState(state, code) {
	this.state = state || {};
	this.code = code || '';
}

function JSParseError(message, node) {
	this.line = (node.loc  || node.location).start.line;
	this.column = (node.loc || node.location).start.column;
	this.filename = (node.loc || node.location).filename;
	this.message = message + ' (' + this.filename + ':' + this.line + ':' + this.column + ')';
	Error.captureStackTrace(this, JSParseError);
}

JSParseError.prototype = Object.create(Error.prototype);
JSParseError.prototype.name = 'JSParseError';
JSParseError.prototype.constructor = JSParseError;

ParserState.prototype.getClassNames = function () {
	return this.state.classesByName ? Object.keys(this.state.classesByName) : [];
};

ParserState.prototype.getClassNamed = function (name) {
	return this.state.classesByName ? this.state.classesByName[name] : null;
};

ParserState.prototype.getSourceCode = function () {
	return this.code;
};

ParserState.prototype.isGetterPropertyReferenced = function (prop) {
	if (!this.state.References) { return true; } // for unit testing
	return this.state.References && this.state.References.getter && this.state.References.getter[prop];
};

ParserState.prototype.isSetterPropertyReferenced = function (prop) {
	if (!this.state.References) { return true; } // for unit testing
	return this.state.References && this.state.References.setter && this.state.References.setter[prop];
};

ParserState.prototype.isFunctionReferenced = function (prop) {
	if (!this.state.References) { return true; } // for unit testing
	return this.state.References && this.state.References.functions && this.state.References.functions[prop] ||
		this.isGetterPropertyReferenced(prop);
};

ParserState.prototype.getReferences = function () {
	return this.state.References;
};

function count(str, find) {
	var re = new RegExp(find, 'g');
	var found = str.match(re);
	return found && found.length || 0;
}

function decodeStruct(str, offset) {
	offset = offset === undefined ? 0 : offset;
	var i = str.indexOf('}', offset);
	while ( i !== -1) {
		var struct = str.substring(offset, i + 1);
		if (count(struct, '{') === count(struct, '}')) {
			return struct;
		}
		i = str.indexOf('}', i + 1);
	}
	return str;
}

function getEncoding(state, metabase, imports, str, index) {
	var ch = str.charAt(index),
		skip,
		enc,
		struct,
		e;
	switch (ch) {
		// skip these
		case 'r': case 'n': case 'N': case 'o': case 'O': case 'R': case 'V': {
			return { value: '' };
		}
		case 'i': return { value: 'int', encoding: ch, type: 'int' };
		case 'd': return { value: 'double', encoding: ch, type: 'double' };
		case 'f': return { value: 'float', encoding: ch, type: 'float' };
		case 'l': return { value: 'long', encoding: ch, type: 'long' };
		case 's': return { value: 'short', encoding: ch, type: 'short' };
		case 'c': return { value: 'char', encoding: ch, type: 'char' };
		case 'B': return { value: 'bool', encoding: ch, type: 'bool' };
		case 'q': return { value: 'long long', encoding: ch, type: 'long long' };
		case 'C': return { value: 'unsigned char', encoding: ch, type: 'unsigned char' };
		case 'I': return { value: 'unsigned int', encoding: ch, type: 'unsigned int' };
		case 'S': return { value: 'unsigned short', encoding: ch, type: 'unsigned short' };
		case 'L': return { value: 'unsigned long', encoding: ch, type: 'unsigned long' };
		case 'Q': return { value: 'unsigned long long', encoding: ch, type: 'unsigned long long' };
		case '#': return { value: 'Class', encoding: ch, type: 'Class' };
		case ':': return { value: 'SEL', encoding: ch, type: 'SEL' };
		case '*': return { value: 'char *', encoding: ch, type: 'char *' };
		case 'v': return { value: 'void', encoding: ch, type: 'void' };
		case '?': return { value: 'void *', encoding: ch, type: 'void *' };
		case '{': {
			// structure, parse it
			enc = decodeStruct(str, index);
			skip = enc.length - 1;
			var i = enc.indexOf('=');
			var value = 'void *';
			if (i > 0) {
				var name = enc.substring(1, i);
				struct = metabase.structs[name];
				value = struct && struct.name || enc;
			}
			return {
				type: 'struct',
				value: value,
				skip: skip,
				encoding: enc
			};
		}
		case '@': {
			skip = 0;
			// block
			if (str.charAt(index + 1) === '?') {
				skip = 1;
			}
			return {
				value: 'id',
				skip: skip,
				type: 'objc_interface',
				encoding: skip ? '@?': '@'
			};
		}
		case '^': {
			// pointer
			enc = getEncoding(state, metabase, imports, str, (index || 0) + 1);
			return {
				value: enc.value + ' *',
				skip: enc.skip || (enc.value.length - 2),
				encoding: '^' + enc.encoding,
				type: enc.value + ' *'
			};
		}
		case '[': {
			// custom class encoding such as [UIView]
			var n = str.indexOf(']', index + 1);
			var cls = str.substring(index + 1, n);
			if (cls in metabase.classes) {
				e = metabase.classes[cls];
				return {
					value: cls + ' *',
					type: 'objc_interface',
					encoding: '@',
					skip: cls.length + 1,
					framework: e.framework,
					filename: e.filename
				};
			} else if (cls in metabase.structs) {
				var encoding = '{' + cls;
				struct = metabase.structs[cls];
				struct.fields && struct.fields.forEach(function (f) {
					encoding+=f.encoding;
				});
				encoding += '}';
				return {
					value: cls,
					skip: cls.length + 1,
					encoding: encoding,
					type: 'struct'
				};
			} else if (cls === 'id') {
				return {
					value: 'id',
					type: 'objc_interface',
					encoding: '@',
					skip: cls.length + 1
				};
			} else if (cls in metabase.protocols) {
				e = metabase.protocols[cls];
				return {
					value: 'NSObject <' + cls + '> *',
					type: 'objc_interface',
					encoding: '@',
					skip: cls.length + 1,
					framework: e.framework,
					filename: e.filename
				};
			} else if (cls in metabase.typedefs) {
				var t = metabase.typedefs[cls];
				return {
					value: t.value,
					type: t.type,
					encoding: t.encoding,
					skip: cls.length + 1,
					framework: t.framework,
					filename: t.filename
				};
			}
			if (state.customClasses && cls in state.customClasses) {
				return {
					value: cls + ' *',
					type: 'objc_interface',
					encoding: '@',
					skip: cls.length + 1,
					framework: 'hyperloop',
					filename: cls
				};
			}
		}
	}
	throw new Error("unknown encoding " + str + ' start at index ' + index);
}

function parseEncoding(state, metabase, imports, encoding) {
	var i = encoding.indexOf('@:');
	var rt = encoding.substring(0, i);
	var argtypes = encoding.substring(i + 2);
	var args = [];
	for (var c = 0; c < argtypes.length; c++) {
		var enc = getEncoding(state, metabase, imports, argtypes, c);
		enc.value && args.push(enc);
		c += enc.skip || 0;
	}
	return {
		returns: getEncoding(state, metabase, imports, rt, 0),
		args: args
	};
}

function generateIdentifier(selector, instance, cls) {
	return utillib.generateSafeSymbol(cls.name + '_' + selector + '_' + (instance ? '1': '0'));
}

// FIXME: Move this out to a template?
function generateMethod(state, metabase, imports, cls, classDef, selector, encoding, instance, body) {
	var details = parseEncoding(state, metabase, imports, encoding),
		argnames = selector.split(':'),
		code = [],
		identifier = generateIdentifier(selector, instance, classDef),
		methodName = utillib.camelCase(selector);

	//TODO: if we are extended a class or implementing a protocol and overriding
	//the method, we can just look up the method so that the developer doesn't have
	//to specify the encoding

	// add the class for JS generation later
	var addMethod;
	if (!(methodName in cls.methods)) {
		cls.methods[methodName] = {
			name: methodName,
			arguments: [],
			returns: details.returns,
			instance: instance
		};
		addMethod = true;
	}

	var method = (instance ? '-' : '+') + '(' + details.returns.value + ')' + argnames[0];
	details.args.forEach(function (arg, index) {
		var name = argnames[index];
		if (index) {
			method+=' '+name;
		}
		method+=':('+arg.value+')arg' + index;
		if (addMethod) {
			arg.name = argnames[index];
			cls.methods[methodName].arguments.push(arg);
		}
		utillib.resolveArg(metabase, imports, arg);
	});

	if (body) {
		code.push(method + ' {');

		var args = [],
			isVoid = details.returns.type === 'void';

		code.push('\t@autoreleasepool {');
		code.push('\t\tid refSelf = self;');
		if (!isVoid) {
			code.push('\t\t__block id result_ = nil;');
		}
		details.args.forEach(function (arg, i) {
			if (utillib.isObjectType(arg.type, arg.encoding)) {
				code.push('\t\t' + utillib.getObjCReturnResult(arg, 'arg' + i, 'id _arg' + i +' =', ''));
			} else {
				code.push('\t\t' + utillib.getObjCReturnResult(arg, 'arg' + i, 'id _arg' + i +' ='));
			}
			args.push('_arg' + i);
		});
		code.push('\t\tvoid(^Callback)(void) = ^{');
		code.push('\t\t\t' + (isVoid ? '' : 'result_ = ') + '[HyperloopUtils invokeCustomCallback:@[' + args.join(', ') + '] identifier:@"' + identifier + '" thisObject: refSelf];');
		args.forEach(function (n) {
			code.push('\t\t\t' + n + ';');
		});
		code.push('\t\t\trefSelf;');
		code.push('\t\t};');

		code.push('\t\tif ([NSThread isMainThread]) {');
		code.push('\t\t\tCallback();');
		code.push('\t\t} else {');
		code.push('\t\t\tdispatch_sync(dispatch_get_main_queue(), Callback);');
		code.push('\t\t}');

		if (!isVoid) {
			code.push('\t\t' + details.returns.value + ' result$ = ' + utillib.toValueDefault(details.returns.encoding, details.returns.type) + ';');
			if (utillib.isPrimitive(details.returns.encoding)) {
				code.push('\t\tif (result_ && ([result_ isKindOfClass:[HyperloopPointer class]] || [result_ isKindOfClass:[NSNumber class]])) {');
			} else {
				code.push('\t\tif (result_ && [result_ isKindOfClass:[HyperloopPointer class]]) {');
			}
			code.push('\t\t' + utillib.generateObjCValue({imports:imports}, metabase, details.returns, details.returns, 'result', '\t\t'));
			code.push('\t\t\tresult$ = result;');
			if (utillib.isObjectType(details.returns.type, details.returns.encoding)) {
				code.push('\t\t} else if ([result_ isEqual:[NSNull null]]==NO) {');
				code.push('\t\t\tresult$ = result_;');
			}
			code.push('\t\t}');
			code.push('\t\treturn result$;');
		}

		code.push('\t}');
		code.push('}');
	} else {
		code.push(method + ';');
	}

	return code.join('\n');
}

Parser.generate = function (state, metabase) {
	if (Object.keys(state.getClassNames())) {
		var code = state.gencode || [], imports = state.imports || {};
		state.getClassNames().forEach(function (name) {
			var classDef = state.getClassNamed(name);
			var protocols = '';
			var found;
			Object.keys(classDef.importClasses).forEach(function (k) {
				var o = metabase.classes[k] || metabase.protocols[k];
				if (o && o.framework) {
					imports[o.framework + '/' + o.framework] = 1;
				}
			});
			var cls = { methods: {}, name: name, framework: 'Hyperloop', superclass: classDef.extends };
			if (!(found = metabase.classes[classDef.extends])) {
				throw new JSParseError('invalid class specified "' + classDef.extends + '"', classDef);
			}
			imports[found.framework + '/' + found.framework] = 1;
			if (classDef.implements) {
				if (!Array.isArray(classDef.implements)) {
					protocols = [classDef.implements];
				} else {
					protocols = classDef.implements;
				}
				protocols.forEach(function (n) {
					if (!(found = metabase.protocols[n])) {
						throw new JSParseError('invalid protocol specified "' + n + '"', classDef);
					}
				});
				protocols && protocols.length && (protocols = ' <' + protocols.join(', ') + '>');
			}
			code.push('/**');
			code.push(' * user class defined at ' + classDef.location.filename + ':' + classDef.location.start.line);
			code.push(' */');
			code.push('@interface ' + classDef.name + ' : ' + classDef.extends + protocols);
			code.push('');
			var methods = classDef.methods;
			var interfaces = [], implementations = [];
			methods && Object.keys(methods).forEach(function (m) {
				var method = methods[m];
				interfaces.push(generateMethod(state && state.state, metabase, imports, cls, classDef, method.selector, method.encoding, method.instance));
				implementations.push(generateMethod(state && state.state, metabase, imports, cls, classDef, method.selector, method.encoding, method.instance, true));
				interfaces.push('');
				implementations.push('');
			});
			code.push(interfaces.join('\n'));
			code.push('@end');
			code.push('');
			code.push('@implementation ' + classDef.name);
			code.push('');
			code.push(implementations.join('\n'));
			code.push('@end');
			code.push('');

			// record the class
			state.genclasses = state.genclasses || [];
			state.genclasses.push(cls);
		});

		state.imports = imports;
		state.gencode = code;

		// generate JS class wrappers source data
		var customClasses = {};
		var mappings = [];
		if (state.genclasses) {
			state.genclasses.forEach(function (cls) {
				cls.methods.addMethod = {
					name: 'addMethod',
					instance: false,
					arguments:[],
					impl: function () {
						return 'Hyperloop.addMethod(this, arguments[0]);';
					}
				};
				customClasses[cls.name] = classgen.generate(metabase, cls, state);
				mappings[cls.name] = '/hyperloop/' + (cls.framework + '/' + cls.name).toLowerCase();
			});
		}

		return {
			classes: customClasses,
			mappings: mappings
		};
	}

	return null;
};

var IgnoreSymbols = [
	'exports',
	'valueOf',
	'toString',
	'_',
	'constructor',
	'hasOwnProperty',
	'require',
	'isArray',
	'apply',
	'call',
	'prototype',
	'Backbone',
	'Alloy',
	'jQuery',
	'Zepto',
	'\\$'
];

var IgnoreRegex = new RegExp('^(' + IgnoreSymbols.join('|') + ')$'),
	IgnoreAlloy = /^(__|ALLOY_)/;

function isValidSymbol (prop, node) {
	if (IgnoreRegex.test(prop) || IgnoreAlloy.test(prop)) {
		return false;
	}
	return true;
}

function segments (node, parts) {
	parts = parts || [];
	if (node && node.property && node.property.name) {
		parts.push(node.property.name);
	}
	if (node.object) {
		return segments(node.object, parts);
	}
	return parts.reverse();
}

function addSymbolReference (state, node, key) {
	var parts = segments(node);
	if (parts && parts.length) {
		parts.forEach(function (p) {
			isValidSymbol(p) && (state.References[key][p] = (state.References[key][p] || 0) + 1);
		});
	}
}

/**
 * parse a buf of JS into a state object
 */
Parser.prototype.parse = function (buf, fn, state) {
	if (!buf || !buf.length) {
		return null;
	}

	if (typeof(state) === 'undefined') {
		state = {};
	} else {
		state = state.state;
	}

	// preserve across multiple files
	state.classesByName = state.classesByName || {};

	// reset these per module
	state.classesByVariable = {};
	state.referencedClasses = {};

	// these are symbol references found in our source code.
	// this is a little brute force and sloppy but gets
	// us 80+% of the way there. if we can't find the symbol
	// anywhere referenced, then we can safely drop it from
	// code generation and save a huge amount of space in
	// the generated wrapper
	state.References = state.References || {
		setter: {},
		getter: {},
		functions: {}
	};

	// turn it into a buffer
	buf = buf.toString();

	const ast = babelParser.parse(buf, { sourceFilename: fn, sourceType: 'unambiguous' });
	let mutated = false;
	const ASTWalker = {
		ExpressionStatement: function(p) {
			p.node.expression && addSymbolReference(state, p.node.expression, 'getter');
		},
		CallExpression: function(p) {
			// do symbol detection first
			addSymbolReference(state, p.node.callee, 'getter');
			if (p.node.callee.property) {
				const prop = p.node.callee.property.name;
				isValidSymbol(prop) && (state.References.functions[prop] = (state.References.functions[prop] || 0) + 1);
			}
			if (p.node.arguments && p.node.arguments.length) {
				p.node.arguments.forEach(function (arg) {
					addSymbolReference(state, arg, 'getter');
				});
			}
			if (p.node.callee.name) {
				const prop = p.node.callee.name;
				isValidSymbol(prop) && (state.References.functions[prop] = (state.References.functions[prop] || 0) + 1);
			}

			if (isHyperloopMethodCall(p.node, 'defineClass')) {
				if (p.parent.type !== 'VariableDeclaration' && p.parent.type !== 'VariableDeclarator') {
					throw new JSParseError('Hyperloop.defineClass must return a class definition into a variable', p.node);
				}
				var classSpec = makeHyperloopClassFromCall(state, p);
				if (classSpec.name in state.classesByName) {
					throw new JSParseError('Hyperloop.defineClass cannot define multiple classes with the same name "' + classSpec.name + '"', p.node);
				}
				if (classSpec.variable in state.classesByVariable) {
					throw new JSParseError('Hyperloop.defineClass cannot define multiple classes with the same variable name "' + classSpec.variable + '"', p.node);
				}
				state.classesByName[classSpec.name] = classSpec;
				state.classesByVariable[classSpec.variable] = classSpec;
			} else if (isHyperloopAddMethodCall(p.node, state)) {
				mutated = true;
				addHyperloopMethodToClass(p, state);
			}
		},
		VariableDeclaration: function(p) {
			if (p.node.declarations && p.node.declarations.length) {
				p.node.declarations.forEach(function (decl) {
					decl.init && addSymbolReference(state, decl.init, 'getter');
				});
			}
		},
		MemberExpression: function(p) {
			if (!/^(AssignmentExpression|CallExpression|ExpressionStatement|VariableDeclaration)$/.test(p.parent.type)) {
				addSymbolReference(state, p.node, 'getter');
			}
		},
		AssignmentExpression: function(p) {
			addSymbolReference(state, p.node.left, 'setter');
			addSymbolReference(state, p.node.right, 'getter');
		},
		Identifier: function(p) {
			if (isHyperloopReferenced(p, state)) {
				// just record
			}
		}
	};
	traverse(ast, ASTWalker);

	var code;
	// re-generate if it changed, otherwise we can skip and use original content
	if (mutated) {
		code = generate(ast, {}).code;
	}

	return new ParserState(state, code);
};

function isHyperloopMethodCall(node, method) {
	return node &&
		node.type === 'CallExpression' &&
		node.callee &&
		node.callee.type === 'MemberExpression' &&
		node.callee.object &&
		node.callee.object.type === 'Identifier' &&
		node.callee.object.name === 'Hyperloop' &&
		node.callee.property &&
		node.callee.property.type === 'Identifier' &&
		node.callee.property.name === method;
}

function isHyperloopAddMethodCall(node, state) {
	return node &&
		node.type === 'CallExpression' &&
		node.callee &&
		node.callee.type === 'MemberExpression' &&
		node.callee.property &&
		node.callee.property.type === 'Identifier' &&
		node.callee.property.name === 'addMethod' &&
		node.callee.object &&
		node.callee.object.type === 'Identifier' &&
		node.callee.object.name in state.classesByVariable;
}

/**
 * [isHyperloopReferenced description]
 * @param  {Object}  p  babelParser AST node path
 * @param  {[type]}  state [description]
 * @return {Boolean}       [description]
 */
function isHyperloopReferenced(p, state) {
	const node = p.node;
	if (node.type === 'Identifier' && node.name in state.classesByVariable) {
		if (!isHyperloopAddMethodCall(p.parent && p.parentPath.parent, state)) {
			var classDef = state.classesByVariable[node.name];
			state.referencedClasses[classDef.name] = (state.referencedClasses[classDef.name] || 0) + 1;
		}
	}
}

/**
 * [findVariableDefinition description]
 * @param  {Object} program babelParser AST node for the program/file
 * @param  {String} name    variable name
 * @param  {String} def     default value
 * @return {String}         [description]
 */
function findVariableDefinition(program, name, def) {
	var body = program.body;
	for (var c = 0; c < body.length; c++) {
		var node = body[c];
		if (node.type === 'VariableDeclaration') {
			for (var i = 0; i < node.declarations.length; i++) {
				var decl = node.declarations[i];
				if (decl.type === 'VariableDeclarator' && decl.id && decl.id.type === 'Identifier' && decl.id.name === name) {
					return toJSObject(program, decl.init);
				}
			}
		}
	}
	if (def) {
		return def;
	}
	throw new JSParseError('could not find variable "' + name + '"', program);
}

/**
 * [toJSObject description]
 * @param  {Object} ref  babelParser AST node for program/file
 * @param  {Object} node babelParser AST node
 * @param  {String|Object|Number} def default value
 * @return {String|Object|Number}      [description]
 */
function toJSObject(ref, node, def) {
	if (node) {
		switch (node.type) {
			case 'Literal': // ESTree
			case 'StringLiteral': // babelParser replacements
			case 'NumericLiteral':
			case 'BooleanLiteral':
			case 'NullLiteral':
			case 'RegExpLiteral': {
				return node.value;
			}
			case 'ArrayExpression': {
				return node.elements.map(function (el) {
					return toJSObject(ref, el);
				});
			}
			case 'ObjectExpression': {
				var result = {};
				node.properties.forEach(function (p) {
					result[toJSObject(ref, p.key)] = toJSObject(ref, p.value);
				});
				return result;
			}
			case 'Identifier': {
				return findVariableDefinition(ref, node.name, node.name);
			}
			case 'BinaryExpression': {
				var left = toJSObject(ref, node.left);
				var right = toJSObject(ref, node.right);
				return left + right;
			}
			case 'FunctionExpression':
			case 'ArrowFunctionExpression': {
				return node;
			}
			case 'UnaryExpression': {
				var op = node.operator;
				var right = toJSObject(ref, node.argument);
				switch (op) {
					case '!': {
						return !+right;
					}
				}
				return eval(op + right);
			}
		}
		throw new JSParseError("Not sure what to do with this node: " + node.type, node);
	} else {
		return def;
	}
}

/**
 * example call:
 *
 * var MyUIView = Hyperloop.defineClass('MyUIView', 'UIView', ['Foo']);
 * @param {Object} state
 * @param {Object} p - babelParser Path: https://github.com/thejameskyle/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-paths
 */
function makeHyperloopClassFromCall(state, p) {
	const node = p.node;
	if (node.arguments.length < 1) {
		throw new JSParseError('Hyperloop.defineClass requires at least 1 argument "className"', node);
	}

	const program = findProgramNode(p);

	const classSpec = {};
	classSpec.name = toJSObject(program, node.arguments[0]);
	classSpec.extends = toJSObject(program, node.arguments[1], 'NSObject');
	classSpec.implements = toJSObject(program, node.arguments[2]);

	let declarationNode = null;
	if (p.parent.type === 'VariableDeclarator') {
		declarationNode = p.parent;
	} else { // VariableDeclaration is parent
		p.parent.declarations.forEach(function(declNode) {
			if (declNode.init === node) {
				declarationNode = declNode;
			}
		});
	}
	if (declarationNode === null) {
		throw new JSParseError('Unable determine designated variable for Hyperloop.defineClass call.');
	}

	classSpec.variable = declarationNode.id.name;
	classSpec.location = node.loc;
	classSpec.importClasses = {};
	classSpec.importClasses[classSpec.extends] = 1;
	if (classSpec.implements) {
		if (Array.isArray(classSpec.implements)) {
			classSpec.implements.forEach(function (k) {
				classSpec.importClasses[k] = 1;
			});
		} else {
			classSpec.importClasses[classSpec.implements] = 1;
		}
	}
	state.customClasses = state.customClasses || {};
	state.customClasses[classSpec.name] = classSpec;
	return classSpec;
}

/**
 * [findProgramNode description]
 * @param  {Object} nodePath babelParser AST path for a given node
 * @return {Node}          Node for the Program
 */
function findProgramNode(nodePath) {
	const programPath = nodePath.findParent(function(p) {
		return p.isProgram();
	});
	return programPath.node;
}

function encodeFriendlyType(type, imports) {
	switch (type) {
		case 'long': return 'l';
		case 'int': return 'i';
		case 'double': return 'd';
		case 'short': return 's';
		case 'float': return 'f';
		case 'long long': return 'q';
		case 'BOOL':
		case 'char': return 'c';
		case 'bool': return 'B';
		case 'void': return 'v';
		case 'void *': return '^v';
		case 'unsigned int': return 'I';
		case 'unsigned long': return 'L';
		case 'unsigned short': return 'S';
		case 'unsigned long long': return 'Q';
		case 'unsigned char': return 'C';
		case 'char *': return '*';
		case 'SEL': case 'selector': return ':';
		case 'Class':
		case 'class': return '#';
		case 'id':
		case 'objc_pointer':
		case 'objc_interface':
		case 'obj_interface':
		case 'object':
		case 'NSObject': return '@';
		default: {
			if (type.indexOf('<') !== -1) {
				type = type.substring(0, type.indexOf('<'));
			}
			imports && (imports[type] = 1);
			return '[' + type + ']';
		}
	}
}

/**
 * [addHyperloopMethodToClass description]
 * @param {Object} p  babelParser AST node path
 * @param {[type]} state [description]
 */
function addHyperloopMethodToClass(p, state) {
	const node = p.node;
	var name = node.callee.object.name;
	var classSpec = state.classesByVariable[name];
	classSpec.methods = classSpec.methods || {};
	if (!node.arguments || !node.arguments.length) {
		throw new JSParseError('addMethod requires at least 1 argument (methodSpec)', node);
	}
	var methodSpec = toJSObject(findProgramNode(p), node.arguments[0]);

	// allow signature instead of selector:
	// signature: 'tableView:heightForRowAtIndexPath:',
	if (methodSpec.signature) {
		methodSpec.selector = methodSpec.signature;
		delete methodSpec.signature;
	}
	// allow a simpler format:
	//        arguments: '@@',
	//        returnType: 'f',
	// you can also specify friendly types:
	//        arguments: 'float',
	//        arguments: ['float', 'int']
	//        returnType: 'float'
	if (methodSpec.returnType || methodSpec.arguments) {
		// both are optional, so encode appropriately
		var type = methodSpec.returnType ? encodeFriendlyType(methodSpec.returnType, classSpec.importClasses) : 'v';
		var args = methodSpec.arguments;
		if (args) {
			// allow it to be an array of friendly types
			if (Array.isArray(args)) {
				args = args.map(function(arg) {
					return encodeFriendlyType(arg, classSpec.importClasses);
				}).join('');
			}
		}
		methodSpec.encoding = type + '@:' + (args || '');
		delete methodSpec.returnType;
		delete methodSpec.arguments;
	}
	if (!methodSpec.encoding) {
		// default is no result, no arguments
		methodSpec.encoding = 'v@:';
	}
	if (methodSpec.encoding) {
		var i = methodSpec.encoding.indexOf('@:');
		var arg = methodSpec.encoding.indexOf(i + 2);
		var argCount = count(methodSpec.selector, ':');
		if (argCount < arg.length) {
			throw new JSParseError('addMethod selector looks invalid. at least ' + argCount + ' arguments are required', node);
		}
	}
	['selector', 'callback'].forEach(function(n) {
		if (!(n in methodSpec)) {
			throw new JSParseError('addMethod argument requires a "' + n + '" property which is the name of the method', node);
		}
	});
	if (methodSpec.selector in classSpec.methods) {
		throw new JSParseError('addMethod cannot add selector "' + methodSpec.selector + '" which already has been added', node);
	}
	methodSpec.instance = methodSpec.instance === undefined ? true : methodSpec.instance;
	// throw this away
	delete methodSpec.callback;
	classSpec.methods[methodSpec.selector] = methodSpec;

	// find the callback node
	var callback = node.arguments[0].properties.filter(function (n) {
		return n.key.name === 'callback';
	})[0];

	// update the properties
	node.arguments[0].properties = [
		t.objectProperty(t.identifier('selector'), t.stringLiteral(methodSpec.selector)),
		t.objectProperty(t.identifier('encoding'), t.stringLiteral(methodSpec.encoding)),
		t.objectProperty(t.identifier('instance'), t.booleanLiteral(methodSpec.instance)),
		callback
	];
	return node;
}

module.exports = Parser;
Parser.ParserState = ParserState;
