/**
 * Hyperloop ®
 * Copyright (c) 2015-2019 by Axway, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */
'use strict';

/** The plugin's identifier */
exports.id = 'hyperloop';

/** The Titanium CLI version that this hook is compatible with */
exports.cliVersion = '>=3.2';

(function () {
	const path = require('path');
	const ejs = require('ejs');
	const fs = require('fs-extra');
	const chalk = require('chalk');
	const appc = require('node-appc');
	const metabase = require(path.join(__dirname, 'metabase'));
	const GenerateMetabaseTask = require('./tasks/generate-metabase-task');
	const GenerateSourcesTask = require('./tasks/generate-sources-task');
	const ScanReferencesTask = require('./tasks/scan-references-task');

	/**
	 * Minimum Titanium SDK version this module supports in string form.
	 * @private @type {String}
	 */
	const TI_MIN = '9.0.0';

	/**
	 * A stylized Hyperloop title to be be printed via the "logger" object.
	 * @private @type {String}
	 */
	const HL = chalk.magenta.inverse('Hyperloop');

	/*
	 Config.
	 */
	function HyperloopAndroidBuilder (_logger, _config, _cli, appc, hyperloopConfig, builder) {
		this.logger = _logger;
		this.config = _config;
		this.cli = _cli;
		this.appc = appc;
		this.cfg = hyperloopConfig;
		this.builder = builder;
	}

	module.exports = HyperloopAndroidBuilder;

	HyperloopAndroidBuilder.prototype.init = async function init(next) {
		const builder = this.builder;
		const logger = this.logger;

		try {
			// Verify minimum SDK version.
			if (!appc.version.satisfies(this.cli.sdk.manifest.version, '>=' + TI_MIN)) {
				logger.error('You cannot use the Hyperloop compiler with a version of Titanium older than ' + TI_MIN);
				logger.error('Set the value of <sdk-version> to a newer version in tiapp.xml.');
				logger.error('For example:');
				logger.error('	<sdk-version>' + TI_MIN + '.GA</sdk-version>');
				process.exit(1);
			}

			// Fetch hyperloop module version from "manifest" file.
			this.moduleVersion = null;
			try {
				const fileContent = await fs.readFile(path.join(__dirname, '..', 'manifest'));
				const match = fileContent.toString().match(/^version\s*:\s*(.*)/m);
				if (match) {
					this.moduleVersion = match[1].trim();
				}
			} catch (err) {
				logger.error(`Failed to read ${HL} 'manifest' file. Reason: ${err}`)
			}

			// Create the hyperloop build directory.
			this.hyperloopBuildDir = path.join(builder.projectDir, 'build', 'hyperloop', 'android');
			await fs.ensureDir(this.hyperloopBuildDir);

			// Fetch info regarding last hyperloop build.
			this.buildManifestJsonPath = path.join(this.hyperloopBuildDir, 'build-manifest.json');
			let hasModuleVersionChanged = true;
			try {
				if (await fs.exists(this.buildManifestJsonPath)) {
					const fileContent = await fs.readFile(this.buildManifestJsonPath);
					const lastModuleVersion = JSON.parse(fileContent).moduleVersion;
					if (lastModuleVersion === this.moduleVersion) {
						hasModuleVersionChanged = false;
					}
				}
			} catch (err) {
			}

			// Clean module's build directory if hyperloop version has changed.
			if (hasModuleVersionChanged) {
				logger.info(`Cleaning ${HL} build directory`);
				await fs.emptyDir(this.hyperloopBuildDir);
			}

			// Perform the hyperloop build.
			await this.build();

			// Create "build-manifest.json" file storing last hyperloop version used to do the build.
			await fs.writeFile(this.buildManifestJsonPath, JSON.stringify({ moduleVersion: this.moduleVersion }));

		} catch (err) {
			logger.error(err);
			process.exit(1);
		}

		// Invoke given callback now that build has finished.
		next();
	};

	HyperloopAndroidBuilder.prototype.build = async function build() {
		this.logger.info(`Starting ${HL} assembly`);

		// Copy our SDK's gradle files to the build directory. (Includes "gradlew" scripts and "gradle" directory tree.)
		const gradlew = this.builder.createGradleWrapper(this.hyperloopBuildDir);
		gradlew.logger = this.logger;
		await gradlew.installTemplate(path.join(this.builder.platformPath, 'templates', 'gradle'));

		// Create a "gradle.properties" file. Will add network proxy settings if needed.
		const gradleProperties = await gradlew.fetchDefaultGradleProperties();
		gradleProperties.push({ key: 'android.useAndroidX', value: 'true' });
		if (this.builder.javacMaxMemory) {
			gradleProperties.push({ key: 'org.gradle.jvmargs', value: `-Xmx${this.builder.javacMaxMemory}` });
		}
		await gradlew.writeGradlePropertiesFile(gradleProperties);
	
		// Create a "local.properties" file providing a path to the Android SDK/NDK directories.
		const androidNdkPath = this.builder.androidInfo.ndk ? this.builder.androidInfo.ndk.path : null;
		await gradlew.writeLocalPropertiesFile(this.builder.androidInfo.sdk.path, androidNdkPath);

		// Copy our root "build.gradle" template script to the root build directory.
		const templatesDir = path.join(this.builder.platformPath, 'templates', 'build');
		await fs.copyFile(
			path.join(templatesDir, 'root.build.gradle'),
			path.join(this.hyperloopBuildDir, 'build.gradle'));

		// Copy our Titanium template's gradle constants file.
		// This provides the Google library versions we use and defines our custom "AndroidManifest.xml" placeholders.
		const tiConstantsGradleFileName = 'ti.constants.gradle';
		await fs.copyFile(
			path.join(templatesDir, tiConstantsGradleFileName),
			path.join(this.hyperloopBuildDir, tiConstantsGradleFileName));

		// Create a "settings.gradle" file referencing a "gradle-project" subdirectory.
		await fs.writeFile(
			path.join(this.hyperloopBuildDir, 'settings.gradle'),
			"include ':gradle-project'\n");

		// Create a "gradle-project" subdirectory.
		const gradleProjectDir = path.join(this.hyperloopBuildDir, 'gradle-project');
		await fs.ensureDir(gradleProjectDir);

		// Generate a "build.gradle" file which provides hyperloop access to:
		// - The main Titanium library.
		// - The libraries under the Titanium project's "./platform/android" directory.
		// - Dependencies referenced by optional "./platform/android/build.gradle" file.
		let buildGradleContent = await fs.readFile(path.join(__dirname, 'build.gradle.ejs'));
		buildGradleContent = ejs.render(buildGradleContent.toString(), {
			compileSdkVersion: this.builder.targetSDK,
			moduleId: this.builder.moduleId,
			minSdkVersion: this.builder.minSDK,
			targetSdkVersion: this.builder.targetSDK,
			tiMavenUrl: encodeURI('file://' + path.join(this.builder.platformPath, 'm2repository').replace(/\\/g, '/')),
			tiProjectPlatformAndroidDir: path.join(this.builder.projectDir, 'platform', 'android'),
			tiSdkVersion: this.builder.titaniumSdkVersion
		});
		await fs.writeFile(path.join(gradleProjectDir, 'build.gradle'), buildGradleContent);

		// Generate an "AndroidManifest.xml" file for the gradle project.
		const gradleProjectSourceMainDir = path.join(gradleProjectDir, 'src', 'main');
		const androidManifestXmlLines = [
			'<?xml version="1.0" encoding="utf-8"?>',
			'<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="hyperloop.stub"/>'
		];
		await fs.ensureDir(gradleProjectSourceMainDir);
		await fs.writeFile(
			path.join(gradleProjectSourceMainDir, 'AndroidManifest.xml'),
			androidManifestXmlLines.join('\n'));

		// Run gradle task "generateJarDependenciesFile" which fetches JAR paths to all dependencies.
		// Results will be written to a "jar-dependencies.txt" file.
		// Note: The "--quiet" option disables gradle's stdout, but will log stderr if an error occurs.
		await gradlew.run(':gradle-project:generateJarDependenciesFile --quiet --console plain');

		// Extract JAR paths from the text file generated by above gradle task.
		const jarDependenciesFilePath = path.join(
			gradleProjectDir, 'build', 'outputs', 'hyperloop', 'jar-dependencies.txt');
		let jarDependenciesFileContent = await fs.readFile(jarDependenciesFilePath);
		jarDependenciesFileContent = jarDependenciesFileContent.toString().replace(/\r/g, '');
		const jarPaths = jarDependenciesFileContent.split('\n');

		// Fetch all public Java APIs from all JARs hyperloop has access to.
		metabase.util.setLog(this.logger);
		const generateMetabaseTask = new GenerateMetabaseTask({
			name: 'hyperloop:generateMetabase',
			inputFiles: jarPaths,
			logger: this.logger
		});
		generateMetabaseTask.outputDirectory = path.join(this.hyperloopBuildDir, 'metabase');
		generateMetabaseTask.builder = this.builder;
		await generateMetabaseTask.run();

		// Fetch all JavaScript file paths from the Titanium project.
		const jsSourceFilePaths = [];
		const traverseDirTree = async directoryPath => {
			const fileNameArray = await fs.readdir(directoryPath);
			for (const fileName of fileNameArray) {
				const filePath = path.join(directoryPath, fileName);
				if ((await fs.stat(filePath)).isDirectory()) {
					await traverseDirTree(filePath);
				} else if (path.extname(fileName).toLowerCase() === '.js') {
					jsSourceFilePaths.push(filePath);
				}
			}
		};
		const projectResourcesDir = path.join(this.builder.projectDir, 'Resources');
		if (await fs.exists(projectResourcesDir)) {
			await traverseDirTree(projectResourcesDir);
		}

		// Scan all JavaScript files for require/import references to a Java class.
		// The results will be stored to task's "references" property.
		const scanReferencesTask = new ScanReferencesTask({
			name: 'hyperloop:scanReferences',
			incrementalDirectory: path.join(this.hyperloopBuildDir, 'incremental', 'scanReferences'),
			inputFiles: jsSourceFilePaths,
			logger: this.logger
		});
		scanReferencesTask.outputDirectory = path.join(this.hyperloopBuildDir, 'references');
		scanReferencesTask.metabase = generateMetabaseTask.metabase;
		await scanReferencesTask.run();

		// Generate JS files which interops with every Java type/package referenced in app's JS code.
		const generateSourcesTask = new GenerateSourcesTask({
			name: 'hyperloop:generateSources',
			incrementalDirectory: path.join(this.hyperloopBuildDir, 'incremental', 'generateSources'),
			inputFiles: jsSourceFilePaths,
			logger: this.logger
		});
		const hyperloopResourcesDir = path.join(this.hyperloopBuildDir, 'Resources');
		generateSourcesTask.outputDirectory = hyperloopResourcesDir;
		generateSourcesTask.metabase = generateMetabaseTask.metabase;
		generateSourcesTask.references = scanReferencesTask.references;
		await generateSourcesTask.run();

		// This event is emitted when build system requests for additional "Resources" directory paths from plugins.
		// "data.args[0]" is an array of paths. We must add hyperloop's "Resources" directory path to it.
		this.cli.on('build.android.requestResourcesDirPaths', {
			pre: async (data, finished) => {
				// Have build system copy all files under hyperloop's "Resources" directory to app.
				const dirPaths = data.args[0];
				dirPaths.push(hyperloopResourcesDir);

				// Tell build system to not "process" hyperloop's generated JS files, except for its bootstrap JS file.
				// Prevents transpile, source-mapping, and encryption. (Huge improvement to build performance.)
				for (const jsFilePath of await generateSourcesTask.fetchGeneratedJsProxyPaths()) {
					this.builder.htmlJsFiles[jsFilePath] = 1;
				}
				finished();
			}
		})
	}
})();
