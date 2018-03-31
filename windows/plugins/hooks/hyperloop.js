/**
 * Hyperloop ® builder for Windows
 * Copyright (c) 2018 by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 *
 *
 * THIS IS A PLUGIN FOR "BUILDING HYPERLOOP MODULE" BINARY
 * THIS IS NOT A PLUGIN HOOK FOR BUILDING TITANIUM APP!
 */
var spawn = require('child_process').spawn,
    async = require('async'),
    path = require('path'),
    fs   = require('fs'),
    ejs  = require('ejs'),
    appc = require('node-appc'),
    wrench = require('wrench');

function isVS2017(data) {
    if (data.windowsInfo && data.windowsInfo.selectedVisualStudio) {
        return /^Visual Studio \w+ 2017/.test(data.windowsInfo.selectedVisualStudio.version);
    }
    return false;
}

exports.cliVersion = ">=3.2";
exports.init = function(logger, config, cli, nodeappc) {
    /*
     * CLI Hook for Hyperloop build dependencies
     */
    cli.on('build.module.pre.construct', function (data, callback) {
        var tasks = [
            function(next) {
                generateCMakeList(data, next);
            },
        ];

        data.projectDir = cli.argv['project-dir'];
        data.manifest = cli.manifest;

        async.series(tasks, function(err) {
            callback(err, data);
        });
    });

    cli.on('build.module.pre.compile', function (data, callback) {
        var tasks = [];
        var archs = ['win10'];

        var csharp_dest = path.join(data.projectDir, 'reflection', 'HyperloopInvocation');
        archs.forEach(function(platform) {
            ['Debug', 'Release'].forEach(function(buildConfig) {
                tasks.push(
                    function(next) {
                        buildSolution(data, csharp_dest, platform, buildConfig, next);
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
        var archs = ['win10'];

        archs.forEach(function(platform){
            ['ARM', 'x86'].forEach(function(arch){
                var from = path.join(data.projectDir, 'reflection', 'HyperloopInvocation', 'bin', platform, 'Release'),
                    to = path.join(data.projectDir, 'build', 'Hyperloop', data.manifest.version, platform, arch);
                if (fs.existsSync(to)) {
                    var files = fs.readdirSync(from);
                    for (var i = 0; i < files.length; i++) {
                        fs.createReadStream(path.join(from, files[i])).pipe(fs.createWriteStream(path.join(to, files[i])));
                    }
                    // Don't copy TitaniumWindows_Hyperloop.winmd
                    var exclude_file = path.join(to, 'TitaniumWindows_Hyperloop.winmd');
                    fs.existsSync(exclude_file) && fs.unlinkSync(exclude_file);
                }
            });
        });

        // Copy hooks
        var hooksFrom = path.join(data.projectDir, 'hooks'),
            hooksTo   = path.join(data.projectDir, 'build', 'hyperloop', data.manifest.version, 'hooks')
        fs.existsSync(hooksTo) || wrench.mkdirSyncRecursive(hooksTo);
        wrench.copyDirSyncRecursive(hooksFrom, hooksTo, {
            forceDelete: true
        });

        callback(null, data);
    });
};

function generateCMakeList(data, next) {

    var template  = path.join(data.projectDir, 'CMakeLists.txt.ejs'),
        cmakelist = path.join(data.projectDir, 'CMakeLists.txt'),
        windowsSrcDir = path.join(data.titaniumSdkPath, 'windows'),
        version = data.manifest.version;

    // Workaround for TIMOB-25433: Add '--run-cmake' when CMakeLists.txt is not found
    if (!fs.existsSync(cmakelist)) {
        data.cli.argv['run-cmake'] = '';
    }

    data.logger.debug('Updating CMakeLists.txt...');

    fs.readFile(template, 'utf8', function (err, data) {
        if (err) throw err;
        data = ejs.render(data, {
            version: appc.version.format(version, 4, 4, true),
            windowsSrcDir: windowsSrcDir.replace(/\\/g, '/').replace(' ', '\\ ')
        }, {});

        fs.writeFile(cmakelist, data, function(err) {
            next(err);
        });
    });

}

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
    var p = spawn(path.join(data.titaniumSdkPath,'windows','cli','vendor','nuget','nuget.exe'), ['restore', slnFile, '-NoCache']);
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
    var p = spawn((process.env.comspec || 'cmd.exe'), ['/S', '/C', '"', vsInfo.vsDevCmd.replace(/[ \(\)\&]/g, '^$&') +
        ' && MSBuild /p:Platform="Any CPU" /p:Configuration=' + buildConfig + ' ' + slnFile + '"'
    ], {windowsVerbatimArguments: true});
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
