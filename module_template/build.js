var babel = require('babel-core');
var fs = require('fs-extra');
var path = require('path');
var linter = require('eslint').linter;
var admzip = require('adm-zip');

var log = console.log;

function readDirRecursive(_currentPath, _subFolder, _paths) {
	var files = fs.readdirSync(_currentPath);
	var pathToFile;
	var fileInfo;
	var fileExtension;
	var currentFile;
	for (var i = 0, len = files.length; i < len; i++) {

		pathToFile = path.join(_currentPath, files[i]);
		fileInfo = fs.lstatSync(pathToFile);
		currentFile = path.join(_subFolder, files[i]);
		if (fileInfo.isDirectory()) {
			readDirRecursive(pathToFile, path.join(_subFolder, files[i]), _paths);
		} else {
			fileExtension = path.extname(pathToFile);			
			if (fileExtension == '.js') {
				currentFile = currentFile.substring(0,currentFile.length-3);
				_paths.js[currentFile] =  'hl_module_' + currentFile.replace(/\//g, '_');
			}
		}
	}
}

function replaceRequires(_content, _paths) {
	return _content.replace(/require\s*\([\\"']+([\w_/-\\.]+)[\\"']+\)/ig, function(orig, match) {
		if (match in _paths) {
			return _paths[match] + '_f()';
		}
		return orig;
	});
}

function wrapModule(_name, _content) {
	var contents = [];
	contents.push('function ' + _name + '_f() {');
	contents.push('if (' + _name + ' !== null) return ' + _name + ';');
	contents.push('var exports = {};')
	contents.push('var module = { exports: exports };');
	contents.push(_content)
    contents.push('if (module.exports !== exports) {');
    contents.push(_name + ' = module.exports;');
    contents.push('} else {');
    contents.push(_name + ' = exports;');
    contents.push('}');
    contents.push('return ' + _name + ';');
    contents.push('}');


	return contents.join('\n');
}

function spaces(_n) {
	if (_n < 0) return '';
	var str = '';
	while (_n--) {
		str += ' ';
	}
	return str;
}
function showConsoleError(_contents, _error, _fileName) {
	var parts = _contents.split('\n');
	var line = _error.line;
	var column = _error.column;
	for (var i = 0, len = parts.length; i < len; i++) {
		log((i+1) + '. ' + parts[i]);
		if (i+1 == line) {
			log(spaces(column + (line+'').length) + '^------ Here');
		}
	}
}

function generatateJavaScriptFromFiles(_allFiles, _src) {
	var main_js = [];
	var fileContent;
	var wrappedContent;
	var moduleMain;
	var returnValue;
	var each;
	for (each in _allFiles) {
		main_js.push('var ' + _allFiles[each] + ' = null;')
	}
	for (each in _allFiles) {
		fileContent = fs.readFileSync(path.join(_src, each + '.js')).toString().replace(/\t/g, '    ');

		var verifier = linter.verify(fileContent, {
			"parser": "babel-eslint"
		}, {
			filename: each
		});
		// log(verifier);
		if (verifier.length) {
			for (var i = 0, len = verifier.length; i < len; i++) {
				var error = verifier[i];
				if (error.fatal) {
					showConsoleError(fileContent, error, each);
					log('============================================================')
					log(each+'.js');
					log(error.message);
					log('line: ' + error.line);
					log('column: ' + error.column);
					log('source: ' + error.source);
					log('============================================================')
					process.exit();
				}
			}
		}
		wrappedContent = wrapModule(_allFiles[each], replaceRequires(fileContent, _allFiles));
		main_js.push(wrappedContent);
	}
	moduleMain = fs.readFileSync(path.join(__dirname, 'template', 'src', 'index.js')).toString();
	main_js.push(replaceRequires(moduleMain, _allFiles));

	returnValue = main_js.join('\n');
	try {
		return babel.transform(returnValue, {
			presets: ["es2015"],
			plugins: ["transform-decorators-legacy"]
		}).code;
	} catch (e) {

		var parts = returnValue.split('\n');
		for (var i = 0, len = parts.length; i < len; i++) {

			log((i+1) + '. ' + parts[i]);
		}

		log(e);
		process.exit();
	}
}

function build(_platform) {
	var src = path.join(__dirname, 'template', 'src', 'platforms', _platform);
	var allFiles = {
		js: {}
	};
	readDirRecursive(src, '', allFiles);
	var js = generatateJavaScriptFromFiles(allFiles.js, src);
	return js;
}



function bundleModule(_platform) {
	var jsContent = build(_platform);
	var platformDistFolder = path.join(__dirname, 'dist', _platform);
	fs.emptyDirSync(platformDistFolder);
	fs.writeFileSync(path.join(platformDistFolder, 'module.js'), jsContent);

}

function createFolder(_path) {
	if (fs.existsSync(_path)) return;
	fs.emptyDirSync(_path);
}

function packageModule(_platforms) {

	var distFolder = path.join(__dirname, 'dist');
	fs.emptyDirSync(distFolder);

	for (var i = 0, len = _platforms.length; i < len; i++) {
		bundleModule(_platforms[i]);
	}

	var moduleJson = require(path.join(__dirname, 'template', 'module.js'));
	var depsFolder = path.join(distFolder, 'ios','dependencies');
	if (moduleJson && moduleJson.dependencies && moduleJson.dependencies['ios']) {
		var iosDependecies = moduleJson.dependencies['ios'];
		if (iosDependecies.files) {
			var depFiles = iosDependecies.files;
			createFolder(depsFolder);
			for (var file in depFiles) {
				var fileName = path.basename(file);
				fs.copySync(path.join(__dirname, file), path.join(depsFolder, fileName));
				var opts = depFiles[file];

				delete depFiles[file];
				depFiles[fileName] = opts;
			}
		}
		if (iosDependecies.libs) {
			var libs = iosDependecies.libs;
			for (var i = 0, len = libs.length; i < len; i++) {
				var libName = path.basename(libs[i]);
				fs.copySync(path.join(__dirname, libs[i]), path.join(depsFolder, libName));
				libs[i] = libName;
			}
		}
	}

	fs.writeFileSync(path.join(distFolder, 'module.json'), JSON.stringify(moduleJson, null, '\t'));

	var zip = new admzip();
	var files = fs.readdirSync(distFolder);
	for (var i = 0, len = files.length; i < len; i++) {
		
		var filePath = path.join(distFolder, files[i]);
		var stats = fs.lstatSync(filePath);

		if (stats.isDirectory()) {
			zip.addLocalFolder(filePath, files[i]);
		} else {
			zip.addLocalFile(filePath);
		}
	}
	zip.writeZip(path.join(__dirname, 'hl_module.zip'));

}

packageModule(['ios']);

