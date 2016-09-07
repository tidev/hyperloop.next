/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
var util = require('./util'),
	swift = require('../swift');

function makeClass (json, cls, state) {
	var entry = {
		class: {
			name: cls.name,
			mangledName: cls.language === 'swift' ? swift.generateSwiftMangledClassName(state.appName, cls.name) : cls.name,
			instance_properties: [],
			class_properties: [],
			instance_methods: [],
			class_methods: []
		},
		framework: cls.framework,
		filename: cls.filename,
		imports: {},
		superclass: cls.superclass && json.classes[cls.superclass],
		state: state
	};
	cls.properties && Object.keys(cls.properties).sort().forEach(function (k) {
		var prop;

		// Skip properties declared because of UIKIT_DEFINE_AS_PROPERTIES being set
		if (isPropertyBecauseOfMacros(cls.framework, cls.name, cls.properties[k].name)) {
			return;
		}

		if (isClassProperty(cls.properties[k])) {
			prop = util.generateClassProperty(entry, json, cls.properties[k]);
		} else {
			prop = util.generateProp(entry, json, cls.properties[k]);
		}

		if (!state.isGetterPropertyReferenced(k)) {
			prop.getter = null;
		}
		if (!state.isSetterPropertyReferenced(k)) {
			prop.setter = null;
		}
		if (prop.setter || prop.getter) {
			if (isClassProperty(cls.properties[k])) {
				entry.class.class_properties.push(prop);
			} else {
				entry.class.instance_properties.push(prop);
			}
		}
	});
	cls.methods && Object.keys(cls.methods).sort().forEach(function (k) {
		var method = cls.methods[k];
		if (!method.framework) {
			method.framework = cls.framework;
		}
		if (shouldSkipMethodIfPropertyAvailable(k, cls)) {
			return;
		}
		if (!state.isFunctionReferenced(method.name)) {
			return;
		}
		if (method.instance) {
			entry.class.instance_methods.push(util.generateInstanceMethod(entry, json, method));
		} else {
			entry.class.class_methods.push(util.generateClassMethod(entry, json, method));
		}
	});
	entry.imports = util.makeImports(json, entry.imports);
	return entry;
}

/**
 * Detects if a property is a new one due to the UIKIT_DEFINE_AS_PROPERTIES or
 * FOUNDATION_SWIFT_SDK_EPOCH_AT_LEAST macros.
 *
 * UIKIT_DEFINE_AS_PROPERTIES and FOUNDATION_SWIFT_SDK_EPOCH_AT_LEAST introduce
 * new readonly properties in favor of methods with the same name. This changes
 * how one would access them in Hyperloop.
 *
 * For example:
 *
 *  // <= iOS 9.3, as method
 *  var color = UIColor.redColor();
 *  // >= iOS 10.0, as property (note the missing parenthesis)
 *  var color = UIColor.redColor;
 *
 * To not break the existing api in hyperloop applications we exclude these
 * properties from being generated as properties in Hyperloop and rely on their
 * getter method instead, which is exactly the same as the old method. This is
 * being removed in future versions of Hyperloop after we had time to announce
 * these breaking changes.
 *
 * @param {String} frameworkName
 * @param {String} classname
 * @param {String} propertyName
 * @return {Boolean}
 */
function isPropertyBecauseOfMacros(frameworkName, className, propertyName) {
	var affectedProperties = { 'Foundation/NSBundle': [ 'mainBundle' ],
  'Foundation/NSCalendar': [ 'currentCalendar', 'autoupdatingCurrentCalendar' ],
  'Foundation/NSCharacterSet':
   [ 'controlCharacterSet',
     'whitespaceCharacterSet',
     'whitespaceAndNewlineCharacterSet',
     'decimalDigitCharacterSet',
     'letterCharacterSet',
     'lowercaseLetterCharacterSet',
     'uppercaseLetterCharacterSet',
     'nonBaseCharacterSet',
     'alphanumericCharacterSet',
     'decomposableCharacterSet',
     'illegalCharacterSet',
     'punctuationCharacterSet',
     'capitalizedLetterCharacterSet',
     'symbolCharacterSet',
     'newlineCharacterSet',
     'URLUserAllowedCharacterSet',
     'URLPasswordAllowedCharacterSet',
     'URLHostAllowedCharacterSet',
     'URLPathAllowedCharacterSet',
     'URLQueryAllowedCharacterSet',
     'URLFragmentAllowedCharacterSet' ],
  'Foundation/NSDate':
   [ 'timeIntervalSinceReferenceDate',
     'distantFuture',
     'distantPast' ],
  'Foundation/NSDateFormatter': [ 'defaultFormatterBehavior' ],
  'Foundation/NSDecimalNumber':
   [ 'zero',
     'one',
     'minimumDecimalNumber',
     'maximumDecimalNumber',
     'notANumber' ],
  'Foundation/NSAssertionHandler': [ 'currentHandler' ],
  'Foundation/NSFileHandle':
   [ 'fileHandleWithStandardInput',
     'fileHandleWithStandardOutput',
     'fileHandleWithStandardError',
     'fileHandleWithNullDevice' ],
  'Foundation/NSFileManager': [ 'defaultManager' ],
  'Foundation/NSHTTPCookieStorage': [ 'sharedHTTPCookieStorage' ],
  'Foundation/NSObject': [ 'accessInstanceVariablesDirectly' ],
  'Foundation/NSLocale': [ 'autoupdatingCurrentLocale', 'currentLocale', 'systemLocale' ],
  'Foundation/NSNotificationCenter': [ 'defaultCenter' ],
  'Foundation/NSNotificationQueue': [ 'defaultQueue' ],
  'Foundation/NSOperationQueue': [ 'currentQueue', 'mainQueue' ],
  'Foundation/NSProcessInfo': [ 'processInfo' ],
  'Foundation/NSRunLoop': [ 'currentRunLoop', 'mainRunLoop' ],
  'Foundation/NSString': [ 'NSStringEncoding', 'defaultCStringEncoding' ],
  'Foundation/NSThread': [ 'currentThread', 'isMainThread', 'mainThread' ],
  'Foundation/NSTimeZone':
   [ 'systemTimeZone',
     'defaultTimeZone',
     'localTimeZone',
     'timeZoneDataVersion' ],
  'Foundation/NSURLCache': [ 'sharedURLCache' ],
  'Foundation/NSURLCredentialStorage': [ 'sharedCredentialStorage' ],
  'Foundation/NSURLRequest': [ 'supportsSecureCoding' ],
  'Foundation/NSURLSession': [ 'sharedSession' ],
  'Foundation/NSURLSessionConfiguration':
   [ 'defaultSessionConfiguration',
     'ephemeralSessionConfiguration' ],
  'Foundation/NSUserDefaults': [ 'standardUserDefaults' ],
  'UIKit/NSFileProviderExtension': [ 'providerIdentifier', 'documentStorageURL' ],
  'UIKit/NSLayoutManager': [ 'firstUnlaidCharacterIndex', 'firstUnlaidGlyphIndex' ],
  'UIKit/NSParagraphStyle': [ 'defaultParagraphStyle' ],
  'UIKit/UIActivity':
   [ 'activityCategory',
     'activityType',
     'activityTitle',
     'activityImage',
     'activityViewController' ],
  'UIKit/UIActivityIndicatorView': [ 'animating' ],
  'UIKit/UIActivityItemProvider': [ 'item' ],
  'UIKit/UIApplication':
   [ 'sharedApplication',
     'ignoringInteractionEvents',
     'registeredForRemoteNotifications',
     'currentUserNotificationSettings' ],
  'UIKit/UICollectionView': [ 'numberOfSections' ],
  'UIKit/UICollectionViewLayout':
   [ 'layoutAttributesClass',
     'invalidationContextClass',
     'collectionViewContentSize' ],
  'UIKit/UIColor':
   [ 'blackColor',
     'darkGrayColor',
     'lightGrayColor',
     'whiteColor',
     'grayColor',
     'redColor',
     'greenColor',
     'blueColor',
     'cyanColor',
     'yellowColor',
     'magentaColor',
     'orangeColor',
     'purpleColor',
     'brownColor',
     'clearColor',
     'lightTextColor',
     'darkTextColor',
     'groupTableViewBackgroundColor',
     'viewFlipsideBackgroundColor',
     'scrollViewTexturedBackgroundColor',
     'underPageBackgroundColor' ],
  'UIKit/UIControl': [ 'allTargets', 'allControlEvents' ],
  'UIKit/UIDevice': [ 'currentDevice' ],
  'UIKit/UIDocument': [ 'hasUnsavedChanges', 'savingFileType' ],
  'UIKit/UIDynamicAnimator': [ 'elapsedTime' ],
  'UIKit/UIFont':
   [ 'fontDescriptor',
     'labelFontSize',
     'buttonFontSize',
     'smallSystemFontSize',
     'systemFontSize' ],
  'UIKit/NSValue':
   [ 'CGPointValue',
     'CGVectorValue',
     'CGSizeValue',
     'CGRectValue',
     'CGAffineTransformValue',
     'UIEdgeInsetsValue',
     'UIOffsetValue' ],
  'UIKit/UIGestureRecognizer': [ 'numberOfTouches' ],
  'UIKit/UIImageView': [ 'animating' ],
  'UIKit/UIManagedDocument': [ 'persistentStoreName' ],
  'UIKit/UIMenuController': [ 'sharedMenuController' ],
  'UIKit/UIPasteboard': [ 'generalPasteboard' ],
  'UIKit/UIPopoverBackgroundView': [ 'wantsDefaultContentAppearance' ],
  'UIKit/UIPresentationController':
   [ 'adaptivePresentationStyle',
     'presentedView',
     'frameOfPresentedViewInContainerView',
     'shouldPresentInFullscreen',
     'shouldRemovePresentersView' ],
  'UIKit/UIPrintInteractionController': [ 'printingAvailable', 'sharedPrintController' ],
  'UIKit/UIRegion': [ 'infiniteRegion' ],
  'UIKit/UIResponder':
   [ 'nextResponder',
     'canBecomeFirstResponder',
     'canResignFirstResponder',
     'isFirstResponder' ],
  'UIKit/UIScreen': [ 'mainScreen' ],
  'UIKit/UISplitViewController': [ 'displayModeButtonItem' ],
  'UIKit/UITabBar': [ 'customizing' ],
  'UIKit/UIView':
   [ 'layerClass',
     'canBecomeFocused',
     'areAnimationsEnabled',
     'inheritedAnimationDuration',
     'requiresConstraintBasedLayout',
     'alignmentRectInsets',
     'intrinsicContentSize',
     'hasAmbiguousLayout' ],
  'UIKit/UILayoutGuide': [ 'hasAmbiguousLayout' ],
  'UIKit/UIViewController':
   [ 'viewLoaded',
     'beingPresented',
     'beingDismissed',
     'movingToParentViewController',
     'movingFromParentViewController',
     'disablesAutomaticKeyboardDismissal',
     'preferredStatusBarStyle',
     'prefersStatusBarHidden',
     'preferredStatusBarUpdateAnimation',
     'shouldAutorotate',
     'supportedInterfaceOrientations',
     'preferredInterfaceOrientationForPresentation',
     'editButtonItem',
     'childViewControllerForStatusBarStyle',
     'childViewControllerForStatusBarHidden',
     'shouldAutomaticallyForwardAppearanceMethods' ] };

	var fqcn = frameworkName + '/' + className;
	return affectedProperties[fqcn] && affectedProperties[fqcn].indexOf(propertyName) !== -1;
}

/**
 * Decides wether a method should be skipped in favor of its matching property.
 *
 * Return true for methods that have the same name as a property (getter) AND
 * that property is not one of those checked for in isPropertyBecauseOfMacros.
 *
 * @param {String} methodKey
 * @param {Object} classMetadata
 * @param {ParserState} state
 * @return {Boolean}
 */
function shouldSkipMethodIfPropertyAvailable(methodKey, classMetadata) {
	var classMethodMetadata = classMetadata[methodKey];
	var matchingPropertyMetadata = classMetadata.properties && classMetadata.properties[methodKey];
	if (!matchingPropertyMetadata) {
		return false;
	}

	if (isPropertyBecauseOfMacros(classMetadata.framework, classMetadata.name, matchingPropertyMetadata.name)) {
		return false;
	}

	return true;
}

/**
 * Returns wether a property is a class property or not
 *
 * @param {Object} propertyMetadata
 * @return {Boolean}
 */
function isClassProperty(propertyMetadata) {
	return propertyMetadata.attributes && propertyMetadata.attributes.indexOf('class') !== -1;
}

/**
 * generate a class file
 */
function generate (dir, json, cls, state) {
	var output = util.generateTemplate('class', {
		data: makeClass(json, cls, state)
	});
	util.generateFile(dir, 'class', cls, output);
}

exports.generate = generate;
