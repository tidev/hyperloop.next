/**
 * get the active (selected) Titanium SDK to build with
 */
var exec = require('child_process').exec,
	path = require('path'),
	titanium = require.resolve('.bin/titanium');

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
	exports.getActivePath(function (err, path, version) {
		if (err) {
			console.error(err);
			process.exit(1);
		}
		switch (process.argv[2]) {
			case '-sdk': {
				console.log(version);
				break;
			}
			case '-minsdk': {
				var semver = require('semver');
				var ver = version.split('.').slice(0, 3).join('.');
				console.log(version);
				if (!semver.satisfies(ver, process.argv[3])) {
					process.exit(1);
				}
				break;
			}
			default: {
				console.log(path);
				break;
			}
		}
		process.exit(0);
	});
}
