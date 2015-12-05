/**
 * get the active (selected) Titanium SDK to build with
 */
var exec = require('child_process').exec,
	path = require('path'),
	titanium = path.join(__dirname, 'node_modules', 'titanium', 'bin', 'titanium');

exports.getActivePath = function (cb) {
	exec('"' + titanium + '" sdk -o json', function (err, out) {
		if (err) { return cb(err); }
		var j = JSON.parse(out);
		var version = j.activeSDK;
		var path = j.installed[version];
		return cb(null, path, version);
	});
}

if (module.id === ".") {
	exports.getActivePath(function (err, path) {
		if (err) {
			console.error(err);
			process.exit(1);
		}
		console.log(path);
		process.exit(0);
	});
}
