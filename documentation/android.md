# Hyperloop for Android Programming Guide

> This documentation is made available before final release and is subject to change without notice and comes with no warranty express or implied.

## Requirements

You'll need to have the following minimum requirements to use Hyperloop for Android:

- Titanium 5.2.0
- Android 2.3.3+ SDK

## Pre-release Installation

For pre-release, you'll need to update to the latest unreleased version of Titanium 5.2.0 by running `ti sdk install -b master -d`.  Make sure you set the version of your application to use this version in your `tiapp.xml` `<sdk-version>`.

## Classes

### Overview

Classes in Hyperloop map to the underlying classes defined in Java.  For example, if you have a class such as `android.view.View` defined, you would reference it using a standard require such as:

```javascript
var View = require('android.view.View');
```

This will return the `View` class object.  Meaning, it's not an instance of a `View`, but the `View` class itself.

Once you have a the Class reference returned from `require`, you can call normal JavaScript property and functions against it. Remember, at this point calling functions or properties against the class object above will be accessing Class level (static) Java methods (not instance level).

For example, you could get the generated view id of the `View` using the example:

```javascript
var generatedId = View.generateViewId();
```

This is because [`generateViewId`](http://developer.android.com/reference/android/view/View.html#generateViewId()) is defined as a static method.

### Instantiation

To instantiate a native Class and create an instance, you can use `new` just as you normally do in Javascript or Java:

```javascript
var view = new View(activity);
```

### Methods and Fields

Methods in Java are mapped to JavaScript functions. Fields in Java are mapped to JavaScript property accessors. static methods or fields (such as constants) will be attached to the class type.

For example:

```java
public class Example {
    public int field;
    public static final String staticString = "";
    public void method(int argument);
    public static boolean staticMethod();
}
```

Would map to the following in JavaScript:

```javascript
example.field = 123;
Example.staticString;
example.method(567);
var result = Example.staticMethod();
```

#### Method resolution

If a class has overloads for a method (multiple forms of the method with different signatures, but the same name), we will attempt to match the correct method to invoke on the Java side by matching the passed in arguments to the closest match. Typically, this involves matching the name, number of arguments and the ability to convert the passed in arguments (in-order) to the method's parameter types. We are slightly more liberal in accepting numeric primitives than typical method resolution due to the conversion of JS Numbers.

### Casting

Sometimes interfaces and classes define generic return types such as `Object`, or declare they return or accept a super type but you know the actual received/passed type will be a subclass of it - and you will need to cast them to a different type to then reference methods and properties of the more specific subclass.

For example, suppose the result of the function returned an `android.view.ViewGroup.LayoutParams` but you know the implementation is actually a `android.widget.FrameLayout.LayoutParams`. You could use the following:

```javascript
var params = view.getLayoutParams();
params = FrameLayoutParams.cast(params);
params.leftMargin = 100;
params.topMargin = 50;
```

**Be careful with casting:**  If you cast an object which is actually something different, you will experience an error and likely a crash.

#### Converting Titanium proxies

You can also convert a Titanium UI Component into its equivalent by passing the titanium proxy into the equivalent UI class' constructor.  For example, this would work:

```javascript
var tiView = Ti.UI.createView( { backgroundColor : "red" } );
var nativeView = new View(tiView);
console.log('X (relative to parent): ', nativeView.getLeft());
```

### Interfaces

Interfaces may be implemented using a Javascript syntax similar to an anonymous Java class. Call the constructor of the interface type with a JS object that contains the overriding method implementations with properties that match the interface method names, and corresponding values as the function that implements that method.

For example, to create an instance that implements `android.view.View.OnTouchListener`:

```javascript
var OnTouchListener = require('android.view.View.OnTouchListener'),
	listener = new OnTouchListener({
		onTouch: function(v, event) {
			// Do some work here
			return true;
		}
	});
```

### Creating your own classes

Hyperloop provides you the ability to dynamically create your own Java classes at runtime.  Once created, these classes can be used as normal in either Hyperloop or passed to native calls. We generate the custom subclass using the "extend" function of the type we want to extend, which takes a single JS Object as an argument containing the overriding method implementations (same as we did for interface implementations). The returned value is a new class type that subclasses the extended type. We can then use the constructor to generate instances of that subclass.

It's easiest to understand with an example - let's create a simple custom subclass of `android.view.View`, and instantiate an instance of it:

```javascript
var Activity = require('android.app.Activity'),
	activity = new Activity(Ti.Android.currentActivity),
	View = require('android.view.View'),
	MyView = android.view.View.extend({
		onDraw: function(canvas) {
			// implementation here
		}
	}),
	view = new MyView(activity);
// Add your custom view to the content...
```

This will create a new class in the Java runtime which will extend `android.view.View` which is equivalent to the following code (though please note that we do _not_ generate Java source, but instead generate Dalvik bytecode that gets loaded into the runtime as a class):

```java
class View_proxy extend android.view.View {

	protected void onDraw(Canvas canvas) {
		// implementation here
	}
}
```

## Using Third-party libraries

You can use Third-party libraries in Hyperloop.

### JARs

Simply place the JAR files into the `platform/android` folder of your app. Hyperloop will pick up the JAR files and will generate necessary bindings and include the JARs in your app.

### AARs

Simply place the AAR files into the `platform/android` folder of your app. Hyperloop will pick up the AAR files and will generate necessary bindings, extract resources, extract and use the classes.jar, *.so file, etc.
