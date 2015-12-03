0.5.5
=========
- Fix CLI hook when mixed with iOS version of module.

0.5.4
=========
- Add caching of class proxies (LRU, up to 25 for now); and instance proxies (all by underlying Java object, with WeakReference).
- try to re-use the same instance proxy so long as we're wrapping the same Java object.

0.5.3
=========
- Fix broken cast implementation

0.5.2
=========
- Fix for properly generating -S args for aapt when using 3rd-party AAR files (missing ':' before package names we append)

0.5.1
=========
- Fix #4 JS wrappers for nested classes don't load up parent type to hang off of

0.5.0
=========
- Support casting native proxies to specific types from JS
```javascript
var params = view.getLayoutParams();
params = FrameLayout.LayoutParams.cast(params);
```

0.4.0
=========
- Handle invoking methods with varargs
- Allow extending Java classes from Javascript.
```javascript
var AuthenticationCallback = require('android.hardware.fingerprint.FingerprintManager.AuthenticationCallback');

var callback = AuthenticationCallback.extend({
	onAuthenticationError: function(code, msg) {
		console.log('onAuthenticationError');
	},
	onAuthenticationHelp: function (code, help) {
		console.log('onAuthenticationHelp');
	},
	onAuthenticationSucceeded: function (result) {
		console.log('onAuthenticationSucceeded');
	},
	onAuthenticationFailed: function () {
		console.log('onAuthenticationFailed');
	},
	onAuthenticationAcquired: function (code) {
		console.log('onAuthenticationAcquired');
	}
});
```

0.3.2
=========
- When invoking a no-argument function on a JS implementation of a Java interface (method with no args), properly pass along an empty argument array, rather than null. Fixes a crash when calling something like `Runnable.run()`

0.3.1
=========
- Fix to force mismatched primitive arguments down to the required parameter type for method calls and constructor invocations (already was done for setting native fields). This is necessary because of loss of type info when crossing from JS Number to Java. We need to be more liberal about accepting double and int for byte/short/double/float/int/long.
- Fix stringify-ing argument array when it contains null arguments (used to output arguments passed into method call when exception occurs during invocation).
- Fix to blow away build/platform pre-build so an alloy project will get custom resources in platform/android/res properly.
- Fix location where temporary build artifacts/files are generated (to be under build folder).

0.3.0
=========
- Allow passing Native hyperloop proxy objects wrapping View subclasses to be passed to methods expecting Ti.UI.View

0.2.0
=========
- Requires 5.2.x build of Titanium SDK with run-on-main-thread property set to 'true'

0.1.0
=========
- Fix crash during callback on an anonymous subclass/implementation of an interface in JS
- Add a couple examples
- try and be a little cleaner about packaged node modules (remove some test directories, install with --production flag)

0.0.9
=========
- Logic fix on delegating hook that deals with making this play nice with iOS version.
- For now, always run invocations of Java methods via reflection in the UI thread. Do only the method invocation in UI thread, not the method resolution/arg conversion. Also don't do invocations of inetrface proxy JS implementations on the UI thread. If they call into Java code, it'll go through the UI thread anyways.
- Small tweak to README for usage/installation to not specify the version number of the module/plugin

0.0.8
=========
- Allow side-by-side installs with the iOS hyperloop module in the same project

0.0.7
=========
- Properly subclass JS wrappers: #3

0.0.6
=========
- Set min Titanium SDK to 5.0.0.GA for now, rather than a dev build: #2
- Handle when project doesn't have a platform/android folder: #1

0.0.5
=========
- interoperate with some Ti proxies - accepting them as arguments to method calls/constructors and allowing converting to hyperloop proxy version.
See an example here where we convert the Ti.Android.Activity from Ti.Android.currentActivity to a hyperloop android.app.Activity object we can pass into a button, and call native methods on.
```javascript
var Activity = require('android.app.Activity'),
	Button = require('android.widget.Button'),
	activity = new Activity(Ti.Android.currentActivity);

var button = new Button(activity);
button.setText("Native button!");
activity.setContentView(button);
```

0.0.4
=========
- instantiate anonymous subclass instances of a single interface
```javascript
// Instantiate a Java interface anonymously:
require('android.view.View.OnClickListener');
var instance = new android.view.View.OnClickListener({
    onClick: function() {
        // Perform action on click
        console.log("On click from JS!");
    }
});
instance.onClick();
```


0.0.3
=========
- Look for JARs in platform/android, not Resources
- Support AARs in platform/android as well


0.0.2
=========
- Support for 3rd-party JARs in Resources/android


0.0.1
=========
- First working version
- Drop in root of project
- Add module , plugin to tiapp.xml
- No subclassing/interface implementation, just usage of native APIs
- generates JS wrappers and metabase dynamically at build time
