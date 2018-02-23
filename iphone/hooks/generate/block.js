/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';
const util = require('./util');

function getBlockAsReturnVariable(name, block) {
	const i = block.indexOf('(^)');
	return block.substring(0, i + 2) + name + block.substring(i + 2);
}

// FIXME this needs to be refactored along with the method above
function generateBlockCallback(state, json, block, arg, tab, define) {
	// TODO: do we need to wrap the callback in a managed object and then
	// JS protect/unprotect?
	// see http://thirdcog.eu/pwcblocks/#objcblocks
	var code = [],
		argnames = [],
		returnVar = define ? getBlockAsReturnVariable(arg.name, arg.value) : arg.name,
		arglist = block.arguments.map(function (arg, i) {
			argnames.push('_arg' + i);
			return arg.value + ' arg' + i;
		});
	code.push(tab + 'if (![' + arg.name + '_ isKindOfClass:[KrollCallback class]]) {');
	code.push(tab + '\t@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"callback must be a function type" userInfo:nil];');
	code.push(tab + '}');
	code.push(tab + 'KrollCallback *callback = (KrollCallback *)' + arg.name + '_;');
	code.push(tab + returnVar + ' = ^(' + arglist.join(', ') + ') {');
	block.arguments.forEach(function (arg, i) {
		code.push(tab + '\t' + util.getObjCReturnResult(json, arg, 'arg' + i, 'id _arg' + i + ' ='));
	});
	code.push(tab + '\tNSArray *args = @[' + argnames.join(', ') + '];');
	// FIXME: move to HyperloopUtils
	code.push(tab + '\t[callback call:args thisObject:nil];');
	code.push(tab + '};');
	return code.join('\n');
}

/**
 * return a suitable (and unique) method name for a block signature
 * @param {string} signature a string from metabase like: "BOOL (^)(KeyType, ObjectType, BOOL *)"
 * @return {string}
 */
function generateBlockMethodName(signature) {
	return 'Block_' + util.generateSafeSymbol(signature);
}

function getType(state, json, arg, argname, obj) {
	switch (arg.value) {
		case 'ObjectType':
		case 'KeyType':
			return 'id ' + argname;
		default:
			if (arg.type === 'block') {
				const block = findBlock(json, arg.value, obj.framework);
				return block.returns.value + '(^' + argname + ')(' + block.arguments.map(function (arg) {
					return arg.value;
				}).join(', ') + ')';
			}
			return arg.value + ' ' + argname;
	}
}

function addImport(state, json, type, value, encoding) {
	switch (type) {
		case 'id':
		case 'objc_pointer':
		case 'obj_interface': {
			if (util.isProtocol(value)) {
				const name = util.getProtocolClass(value);
				// TODO: need to lookup protocols
				break;
			}
			value = value.replace(/\*/g, '').trim();
			if (value in json.classes) {
				const cls = json.classes[value];
				state.frameworks[cls.framework] = 1;
				break;
			}
			break;
		}
		case 'struct': {
			// TODO
			break;
		}
	}
}

/**
 * [generateBlockWrapper description]
 * @param  {[type]} state [description]
 * @param  {object} json  metabase
 * @param  {object} block block extracted from metabase
 * @return {string}
 */
function generateBlockWrapper(state, json, block) {
	const code = [],
		argnames = [];
	const name = generateBlockMethodName(block.signature);
	code.push('+ (id) ' + name + ':(KrollCallback *) callback {');
	const args = block.arguments.map(function (arg, i) {
		if (arg.type !== 'void') {
			argnames.push('_arg' + i);
			addImport(state, json, arg.type, arg.value, arg.encoding);
			return getType(state, json, arg, 'arg' + i, state);
		}
	}).filter(function (n) { return !!n; });
	if (args.length) {
		code.push('\treturn [^(' + args.join(', ') + ') {');
	} else {
		code.push('\treturn [^{');
	}
	code.push('\t\tvoid(^Callback)(void) = ^{');
	code.push('\t\t\tNSArray *args = nil;');
	if (argnames.length) {
		block.arguments.forEach(function (arg, i) {
			if (util.isObjectType(arg.type, arg.encoding)) {
				code.push('\t\t\t' + util.getObjCReturnResult(json, arg, 'arg' + i, 'id _arg' + i + ' =', ''));
			} else {
				code.push('\t\t\t' + util.getObjCReturnResult(json, arg, 'arg' + i, 'id _arg' + i + ' ='));
			}
		});
		code.push('\t\t\targs = @[' + argnames.join(', ') + '];');
	}
	code.push('\t\t\t[HyperloopUtils invokeCallback:callback args:' + (args.length ? 'args' : 'nil') + ' thisObject:callback];');
	code.push('\t\t};');
	code.push('\t\tif ([NSThread isMainThread]) {');
	code.push('\t\t\tCallback();');
	code.push('\t\t} else {');
	code.push('\t\t\tdispatch_async(dispatch_get_main_queue(), Callback);');
	code.push('\t\t}');
	code.push('\t} copy];');
	code.push('}');
	return code.join('\n');
}

/**
 * Find a block "shallow": search metabase's blocks for a given framework name
 * for matching signature.
 * @param  {object}   json      metabase
 * @param  {string}   signature block signature
 * @param  {string} frameworkName        [description]
 * @return {object}
 */
function shallowFindBlock(json, signature, frameworkName) {
	const blocks = json.blocks[frameworkName];
	return blocks.find(block => {
		return block && matchBlockSignature(block.signature, signature);
	});
}

/**
 * Attempt to find a block "deeply" (i.e. fall back to checking typedefs or all blocks for matching signature)
 * @param  {object}   json      metabase
 * @param  {string}   signature block signature
 * @param  {string} frameworkName        [description]
 * @return {object}
 */
function findBlock(json, signature, frameworkName) {
	let found = shallowFindBlock(json, signature, frameworkName);
	if (found) {
		return found;
	}
	// the block signature could actually be a typedef
	if (signature in json.typedefs) {
		return findBlock(json, json.typedefs[signature].value, frameworkName);
	}
	// search through other packages in case it's not defined in the same framework
	const packages = Object.keys(json.blocks);
	packages.find(p => {
		found = shallowFindBlock(json, signature, p); // record match because find will return the package it was found in
		return found; // stop as soon as we find match
	});
	if (found) {
		return found;
	}
	throw new Error(`Couldn't find block with signature: ${signature} for framework: ${frameworkName}`);
}

/**
 * Matches two block signatures against each other to see if they are the same.
 *
 * Sometimes the metabase generator outputs slightly different signatures which
 * describe the same block, e.g. void (^)(_Bool) and void (^)(BOOL). This
 * function tries to normalize both signatures and then matches them again if
 * a direct comparison yields no match.
 *
 * @param {String} signature Block signature
 * @param {String} otherSignature Other block signature to match against
 * @return {Boolean} True if both signatures match, false if not
 */
function matchBlockSignature(signature, otherSignature) {
	if (signature === otherSignature) {
		return true;
	}

	const normalizedSignature = signature.replace(/_Bool|bool/, 'BOOL');
	const normalizedOtherSignature = otherSignature.replace(/_Bool|bool/, 'BOOL');
	if (normalizedSignature === normalizedOtherSignature) {
		return true;
	}

	return false;
}

exports.generateBlockCallback = generateBlockCallback; // used in util.generateObjCValue()
exports.generateBlockMethodName = generateBlockMethodName; // used in method.generateMethodBody()
exports.generateBlockWrapper = generateBlockWrapper;
exports.findBlock = findBlock;
