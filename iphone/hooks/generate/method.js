'use strict';

const util = require('./util');
const blockgen = require('./block');

function generateMethodBody (state, json, method, preamble, instance, thisobj, argCallback) {
	// allow special overrides in method generation
	if (method.impl) {
		return method.impl(state, json, method, instance, thisobj);
	}
	var result = '';
	var end = '';
	var wrapper = null;
	if (method.returns.type !== 'void') {
		wrapper = util.getResultWrapper(state, json, method.returns, instance);
		end = wrapper ? ')' : '';
		result += wrapper;
	}
	var arglist = util.generateArgList(state, json, method.arguments, '[', ']', 'null');
	if (argCallback) {
		arglist = argCallback(arglist);
	}
	method.arguments.forEach(function (arg, i) {
		if (arg.type === 'block') {
			var block = blockgen.findBlock(json, arg.value, method.framework);
			var blockName = blockgen.generateBlockMethodName(block.signature);
			var framework = method.framework;
			var name = arg.name;
			preamble.push('\t// convert to block: ' + block.signature);
			preamble.push('\tvar _' + name + 'Callback = function () {');
			preamble.push('\t\tvar args = [];');
			preamble.push('\t\t// convert arguments into local JS classes');
			if (!block.arguments) {
				console.error(block);
				process.exit(1);
			}
			block.arguments.forEach(function (ba, i) {
				preamble.push('\t\tif (arguments.length > ' + i + ' && arguments[' + i + '] !== null) {');
				var wrapper = util.getResultWrapper(state, json, ba, instance);
				preamble.push('\t\t\targs.push(' +  wrapper + 'arguments[' + i + ']' + (wrapper ? ')' : '') + ');');
				preamble.push('\t\t} else {');
				preamble.push('\t\t\targs.push(null);');
				preamble.push('\t\t}');
			});
			preamble.push('\t\t_' + name + ' && _' + name + '.apply(_' + name + ', args);');
			preamble.push('\t};');
			preamble.push('\tvar _' + name + 'Block = $dispatch(Hyperloop.createProxy({ class: \'Hyperloop' + framework + '\', alloc: false, init: \'class\' }), \'' + blockName + ':\', [_' + name + 'Callback], false);');
			var pref = instance ? 'this' : state.class.name;
			preamble.push('\t' + pref + '.$private.' + method.name + '_' + name + ' = _' + name + ';');
			preamble.push('\t' + pref + '.$private.' + method.name + '_' + name + 'Callback = _' + name + 'Callback;');
			arg.blockname = name + 'Block';
			arg.isBlock = true;
			// re-generate the arg list with the new argument name
			arglist = util.generateArgList(state, json, method.arguments, '[', ']', 'null');
			if (argCallback) {
				arglist = argCallback(arglist);
			}
		}
	});
	var fnname = method.selector || method.name;
	var nativeCall = '\t\t\tvar result = $dispatch(' + thisobj + ', \'' + fnname + '\', ' + arglist + ', ' + instance + ');';
	if (!wrapper) {
		return nativeCall;
	}
	var lastChance = '\n\t\t\tif (result === undefined || result === null) return result;\n';
	return nativeCall + lastChance + '\t\t\tresult = ' + result + 'result' + end + ';';
}

exports.generateMethodBody = generateMethodBody;
