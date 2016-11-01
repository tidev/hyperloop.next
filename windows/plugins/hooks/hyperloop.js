var spawn = require('child_process').spawn,
    path = require('path'),
    async = require('async'),
    fs = require('fs');

exports.cliVersion = ">=3.2";
exports.init = function(logger, config, cli, nodeappc) {
    /*
     * CLI Hook for Hyperloop build dependencies
     */
    cli.on('build.module.pre.compile', function (data, callback) {
        var dest = path.join(data.projectDir, 'reflection', 'HyperloopInvocation'),
            tasks = [];

        ['phone', 'store', 'win10'].forEach(function(platform) {
            ['Debug', 'Release'].forEach(function(buildConfig) {
                tasks.push(
                    function(next) {
                        buildSolution(data, dest, platform, buildConfig, next);
                    }
                );
            });
        });

        async.series(tasks, function(err) {
            callback(err, data);
        });

    });
    
    /*
     * Copy dependencies
     */
    cli.on('build.module.pre.package', function (data, callback) {
        ['phone', 'store', 'win10'].forEach(function(platform){
            ['ARM', 'x86'].forEach(function(arch){
                var from = path.join(data.projectDir, 'reflection', 'HyperloopInvocation', 'bin', platform, 'Release'),
                    to = path.join(data.projectDir, 'build', 'Hyperloop', data.manifest.version, platform, arch);
                if (fs.existsSync(to)) {
                    var files = fs.readdirSync(from);
                    for (var i = 0; i < files.length; i++) {
                        fs.createReadStream(path.join(from, files[i])).pipe(fs.createWriteStream(path.join(to, files[i])));
                    }
                }
            });
        });
        callback(null, data);
    });
};

function buildSolution(data, dest, platform, buildConfig, callback) {
    var slnFile = path.join(dest, platform, 'HyperloopInvocation.sln');
    runNuGet(data, slnFile, function(err) {
        if (err) throw err;
        runMSBuild(data, slnFile, buildConfig, callback);
    });
}

function runNuGet(data, slnFile, callback) {
    var logger = data.logger;
    // Make sure project dependencies are installed via NuGet
    var p = spawn('nuget.exe', ['restore', slnFile]);
    p.stdout.on('data', function (data) {
        var line = data.toString().trim();
        if (line.indexOf('error ') >= 0) {
            logger.error(line);
        } else if (line.indexOf('warning ') >= 0) {
            logger.warn(line);
        } else if (line.indexOf(':\\') === -1) {
            logger.debug(line);
        } else {
            logger.trace(line);
        }
    });
    p.stderr.on('data', function (data) {
        logger.warn(data.toString().trim());
    });
    p.on('close', function (code) {
        if (code != 0) {
            process.exit(1); // Exit with code from nuget?
        }
        callback();
    });
}

function runMSBuild(data, slnFile, buildConfig, callback) {
    var logger = data.logger, 
        windowsInfo = data.windowsInfo,
        vsInfo  = windowsInfo.selectedVisualStudio;

    if (!vsInfo) {
        logger.error('Unable to find a supported Visual Studio installation');
        process.exit(1);
    }

    logger.debug('Running MSBuild on solution: ' + slnFile);

    // Use spawn directly so we can pipe output as we go
    var p = spawn(vsInfo.vcvarsall, [
        '&&', 'MSBuild', '/p:Platform=Any CPU', '/p:Configuration=' + buildConfig, slnFile
    ]);
    p.stdout.on('data', function (data) {
        var line = data.toString().trim();
        if (line.indexOf('error ') >= 0) {
            logger.error(line);
        }
        else if (line.indexOf('warning ') >= 0) {
            logger.warn(line);
        }
        else if (line.indexOf(':\\') === -1) {
            logger.debug(line);
        }
        else {
            logger.trace(line);
        }
    });
    p.stderr.on('data', function (data) {
        logger.warn(data.toString().trim());
    });
    p.on('close', function (code) {

        if (code != 0) {
            logger.error('MSBuild fails with code ' + code);
            process.exit(1); // Exit with code from msbuild?
        }

        callback();
    });
}