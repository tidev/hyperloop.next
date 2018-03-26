'use strict';

/**
 * Is the reference to a "builtin"?
 * TODO: Delegate to code in generate library where we handle builtins?
 * @param  {String} frameworkName possible framework name
 * @return {boolean}
 */
function isBuiltin(frameworkName) {
	return frameworkName === 'Titanium';
}
exports.isBuiltin = isBuiltin;
