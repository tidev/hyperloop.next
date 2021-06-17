/**
 * Hyperloop Module
 * Copyright (c) 2015-present by Appcelerator, Inc.
 */
#import "HyperloopModule.h"
#import "define.h"
#import "class.h"
#import "pointer.h"
#import "utils.h"

#ifdef TIMODULE
#import "TiBase.h"
#import "KrollContext.h"
#import "KrollBridge.h"
#import "KrollCallback.h"
#import "TiHost.h"
#import "TiModule.h"
#import "KrollObject.h"
#import "TiEvaluator.h"
#import "TiHost.h"
#import "HyperloopView.h"
#import "TiViewProxy.h"
#else
	#import "UIKit/UIKit.h"
	// for unit testing
	@interface KrollContext : NSObject
		-(JSContextRef)context;
	@end
	@interface KrollBridge : NSObject
		-(id)require:(KrollContext*)kroll path:(NSString*)path;
	@end
	@interface KrollObject : NSObject
		+(id)toID:(KrollContext *)c value:(JSValueRef)ref;
		-(JSObjectRef) propsObject;
	@end
	@interface KrollWrapper : NSObject
		@property (nonatomic,readwrite,assign)	JSObjectRef jsobject;
	@end
	@interface KrollCallback : NSObject
	@end
	@interface TiViewProxy : NSObject
		@property(nonatomic,readwrite,retain) UIView * view;
	@end
#endif

#if TARGET_OS_SIMULATOR
extern void JSSynchronousGarbageCollectForDebugging(JSContextRef);
#endif

static JSClassRef classClassRef;
static JSClassRef pointerClassRef;
static JSClassRef constructorClassRef;
static JSClassRef objectClassRef;
static KrollContext *context = nil;
static KrollBridge *bridge = nil;
static NSMutableDictionary <NSString *, KrollCallback *> * callbacks = nil;
static NSMutableDictionary <NSString *, KrollWrapper *> * modules = nil;
static CFMutableDictionaryRef javaScriptWrappers = NULL;

static NSString* HyperloopGetMemoryAddressOfId(id data);
static void HyperloopRegisterWrapper(id pointer, JSValueRef thisObject);
static JSObjectRef HLObjectMake(JSContextRef ctx, JSClassRef cls, id obj);
JSObjectRef HyperloopGetWrapperForId(id obj);

static void HyperloopRelease () {
	if (context) {
		[callbacks removeAllObjects];
		[modules removeAllObjects];
		ARCRelease(callbacks);
		ARCRelease(modules);
		classClassRef = NULL;
		pointerClassRef = NULL;
		constructorClassRef = NULL;
		objectClassRef = NULL;
		bridge = nil;
		context = nil;
		callbacks = nil;
		modules = nil;
	}
	if (javaScriptWrappers) {
		CFRelease(javaScriptWrappers);
		javaScriptWrappers = NULL;
	}
}

/**
 * gets the memory address of an Objective-C object as a string
 */
static NSString* HyperloopGetMemoryAddressOfId (id data) {
	if (data == nil) { return nil; }

	if ([data isKindOfClass:[HyperloopPointer class]]) {
		HyperloopPointer* pointer = (HyperloopPointer*)data;

		if ([pointer structure]) {
			return [NSString stringWithFormat:@"%p", [[pointer structure] pointer]];
		}
		if ([pointer pointer]) {
			return [NSString stringWithFormat:@"%p", [pointer pointer]];
		}
		if ([pointer value]) {
			id rObj = [[pointer value] object];
#ifdef TIMODULE
			if ([rObj isKindOfClass:[HyperloopView class]]) {
				id v = [[(HyperloopView*)rObj subviews] objectAtIndex:0];
				return [NSString stringWithFormat:@"%p%@", v,[v class]];
			}
#endif
			return [NSString stringWithFormat:@"%p%@", rObj,[rObj class]];
		}
		if ([pointer nativeObject]) {
			return  [NSString stringWithFormat:@"%p%@", [pointer nativeObject],[[pointer nativeObject] class]];
		}
	} else if ([data isKindOfClass:[HyperloopClass class]]) {
		return [NSString stringWithFormat:@"%p%@", [(HyperloopClass*)data target],[[(HyperloopClass*)data target] class]];
	}

	return [NSString stringWithFormat:@"%p%@", data, [data class]];
}

/**
 * stores the JS object in a non-retaining dictionay, `javaScriptWrappers`, using the memory
 * address (as a string) from an Objective-C object as the key
 */
static void HyperloopRegisterWrapper (id pointer, JSValueRef thisObject) {
	if (pointer == nil || thisObject == NULL) {
		return;
	}
	if (javaScriptWrappers == NULL) {
		javaScriptWrappers = CFDictionaryCreateMutable(NULL, 0, &kCFCopyStringDictionaryKeyCallBacks, NULL);
		CFRetain(javaScriptWrappers);
	}
	CFStringRef pointerString = (__bridge CFStringRef)HyperloopGetMemoryAddressOfId(pointer);
	if (CFDictionaryContainsKey(javaScriptWrappers, pointerString)) {
		 // NSLog(@"[HYPERLOOP] Wrapper replaced %@ %@",pointerString, [pointer class]);
		CFDictionaryReplaceValue(javaScriptWrappers, javaScriptWrappers, thisObject);
	} else {
		 // NSLog(@"[HYPERLOOP] Wrapper registered %@ %@", pointerString, [pointer class]);
		CFDictionaryAddValue(javaScriptWrappers, pointerString, thisObject);
	}
}

/**
 * gets the js object stored in the `javaScriptWrappers` dictionary using the memory
 * address (as a string) from an Objective-C object as the key. Returns NULL if not found
 */
JSObjectRef HyperloopGetWrapperForId (id obj) {
	if (javaScriptWrappers == NULL || obj == nil) { return NULL; }

	CFStringRef key = (__bridge CFStringRef)HyperloopGetMemoryAddressOfId(obj);
	JSObjectRef result = NULL;
	if (CFDictionaryContainsKey(javaScriptWrappers, key)) {
		result = (JSObjectRef)CFDictionaryGetValue(javaScriptWrappers, key);
	}
	return result;
}

/**
 * replacement function for creating JS Objects. It looks for a wrapper in the `javaScriptWrappers` and
 * returns it if found, otherwise calls `JSObjectMake`
 */
static JSObjectRef HLObjectMake (JSContextRef ctx, JSClassRef cls, id obj) {
	JSObjectRef jsObject = HyperloopGetWrapperForId(obj);
	if (jsObject != nil) {
#ifdef TIMODULE
		if ([[obj nativeObject] isKindOfClass:[HyperloopView class]]) {
			// Special case. If this is a UIView attached to a Titanium view, then grab the Titnaium view that owns it
			JSStringRef prop = JSStringCreateWithUTF8CString("$native");
			if (JSObjectHasProperty(ctx, jsObject, prop)) {
				JSObjectSetProperty(ctx, jsObject, prop, JSObjectMake(ctx, pointerClassRef, (__bridge void *)(obj)), kJSPropertyAttributeNone, NULL);
			}
			JSStringRelease(prop);
			}
#endif
		// NSLog(@"[HYPERLOOP] Recycling object %@", [obj class]);
		return jsObject;
	}
	return JSObjectMake(ctx, cls, (__bridge void *)(obj));
}

/**
 * return a registered callback for a given identifier
 */
KrollCallback* HyperloopGetCallbackForIdentifier (NSString *identifier) {
	return [callbacks objectForKey:identifier];
}

/**
 * register a callback for a given identifier
 */
void HyperloopRegisterCallbackForIdentifier (KrollCallback *callback, NSString *identifier) {
	if (callbacks == nil) {
		callbacks = [NSMutableDictionary dictionary];
		ARCRetain(callbacks);
	}
	[callbacks setValue:callback forKey:identifier];
}

/**
 * convert a JSStringRef into a NSString *
 */
static NSString* NSStringFromJSStringRef (JSContextRef ctx, JSStringRef string, JSValueRef *exception) {
	CFStringRef str = JSStringCopyCFString(NULL, string);
	NSString* nsstring = [NSString stringWithString: (__bridge NSString *)str];
	CFRelease(str);
	return nsstring;
}

/**
 * convert a JSValueRef into a NSString *
 */
static NSString* NSStringFromJSValueRef (JSContextRef ctx, JSValueRef value, JSValueRef *exception) {
	JSStringRef string = JSValueToStringCopy(ctx, value, exception);
	return NSStringFromJSStringRef(ctx, string, exception);
}

/**
 * generate a unique and consistent identifier for a given class name, method name and instance type
 */
#ifdef TIMODULE
static
#endif
NSString* GenerateIdentifier (NSString *className, NSString *methodName, BOOL instance) {
	NSError *error = nil;
	NSRegularExpression *re = [NSRegularExpression regularExpressionWithPattern:@"[\\s\\^\\(\\)\\\\<\\\\>\\*\\:\\+,]" options:NSRegularExpressionCaseInsensitive error:&error];
	NSString *safeName = [re stringByReplacingMatchesInString:methodName options:0 range:NSMakeRange(0,[methodName length]) withTemplate:@"_"];
	return [NSString stringWithFormat:@"%@_%@_%s", className, safeName, instance ? "1" : "0"];
}

/**
 * returns true if JSObjectRef is a JS RegExp instance
 */
BOOL isJSRegExp (JSContextRef ctx, JSObjectRef obj, JSValueRef *exception) {
	JSStringRef script = JSStringCreateWithUTF8CString("RegExp");
	JSObjectRef global = JSContextGetGlobalObject(ctx);
	JSValueRef classRef = JSObjectGetProperty(ctx, global, script, exception);
	JSObjectRef classObj = JSValueToObject(ctx, classRef, exception);
	JSStringRelease(script);
	return JSValueIsInstanceOfConstructor(ctx, obj, classObj, exception);
}

/**
 * returns the property for the JSObjectRef as a boolean or false if not found
 */
static BOOL TiPropToBool (JSContextRef ctx, JSObjectRef obj, const char *prop, JSValueRef *exception) {
	JSStringRef propString = JSStringCreateWithUTF8CString(prop);
	JSValueRef value = JSObjectGetProperty(ctx, obj, propString, exception);
	JSStringRelease(propString);
	if (JSValueIsBoolean(ctx, value)) {
		return JSValueToBoolean(ctx, value);
	}
	return false;
}

/**
 * returns an NSError as a JS Error object
 */
static JSValueRef NSErrorToJSException (JSContextRef ctx, NSError *exception) {
	JSStringRef message = JSStringCreateWithUTF8CString([[exception localizedDescription] UTF8String]);
	JSValueRef args[1];
	args[0] = JSValueMakeString(ctx, message);
	JSObjectRef result = JSObjectMakeError(ctx, 1, args, NULL);
	JSValueRef messageRef = JSValueMakeString(ctx, message);
	JSStringRef prop = JSStringCreateWithUTF8CString("description");
	JSObjectSetProperty(ctx, result, prop, messageRef, kJSPropertyAttributeReadOnly, NULL);
	JSStringRelease(message);
	JSStringRelease(prop);
	prop = JSStringCreateWithUTF8CString("name");
	message = JSStringCreateWithUTF8CString([[exception domain] UTF8String]);
	messageRef = JSValueMakeString(ctx, message);
	JSObjectSetProperty(ctx, result, prop, messageRef, kJSPropertyAttributeReadOnly, NULL);
	JSStringRelease(message);
	JSStringRelease(prop);
	NSArray *array = [NSThread callStackSymbols];
	array = [array subarrayWithRange:NSMakeRange(1, [array count] - 1)];
	NSString *stack = [array componentsJoinedByString:@"\n"];
	message = JSStringCreateWithUTF8CString([stack UTF8String]);
	prop = JSStringCreateWithUTF8CString("nativeStack");
	messageRef = JSValueMakeString(ctx, message);
	JSObjectSetProperty(ctx, result, prop, messageRef, kJSPropertyAttributeReadOnly, NULL);
	JSStringRelease(message);
	JSStringRelease(prop);
	return result;
}

/**
 * returns an NSException as a JS Error object
 */
static JSValueRef NSExceptionToJSException (JSContextRef ctx, NSException *exception) {
	JSStringRef message = JSStringCreateWithUTF8CString([[exception reason] UTF8String]);
	JSValueRef args[1];
	args[0] = JSValueMakeString(ctx, message);
	JSObjectRef result = JSObjectMakeError(ctx, 1, args, NULL);
	JSValueRef messageRef = JSValueMakeString(ctx, message);
	JSStringRef prop = JSStringCreateWithUTF8CString("description");
	JSObjectSetProperty(ctx, result, prop, messageRef, kJSPropertyAttributeReadOnly, NULL);
	JSStringRelease(message);
	JSStringRelease(prop);
	prop = JSStringCreateWithUTF8CString("name");
	message = JSStringCreateWithUTF8CString([[exception name] UTF8String]);
	messageRef = JSValueMakeString(ctx, message);
	JSObjectSetProperty(ctx, result, prop, messageRef, kJSPropertyAttributeReadOnly, NULL);
	JSStringRelease(message);
	JSStringRelease(prop);
	NSArray *array = [exception callStackSymbols];
	array = [array subarrayWithRange:NSMakeRange(1, [array count] - 1)];
	NSString *stack = [array componentsJoinedByString:@"\n"];
	message = JSStringCreateWithUTF8CString([stack UTF8String]);
	prop = JSStringCreateWithUTF8CString("nativeStack");
	messageRef = JSValueMakeString(ctx, message);
	JSObjectSetProperty(ctx, result, prop, messageRef, kJSPropertyAttributeReadOnly, NULL);
	JSStringRelease(message);
	JSStringRelease(prop);
	return result;
}

/**
 * attempt to get a class wrapper
 */
static JSObjectRef CreateJSClassFromModulePath (NSString *path, id obj, JSClassRef classRef, BOOL newInstance) {
	JSContextRef ctx = context.context;
	if (modules == nil) {
		modules = [NSMutableDictionary dictionary];
		ARCRetain(modules);
	}
	KrollWrapper *wrapper = nil;
	if (modules &&  [modules objectForKey:path]) {
		wrapper = [modules objectForKey:path];
	}
	if (!wrapper) {
		wrapper = [bridge require:context path:path];
		if (wrapper) {
			// we cache so that titanium doesn't attempt to reload on subsequent constructors
			[modules setValue:wrapper forKey:path];
		}
	}
	if (wrapper) {
		JSObjectRef function = [wrapper jsobject];
		JSObjectRef ref = HLObjectMake(ctx, pointerClassRef, obj);
		if (newInstance) {
			JSValueRef args [] = {ref};
			return JSObjectCallAsConstructor(ctx, function, 1, args, NULL);
		} else {
			// we need to store our pointer since this is a KrollWrapper and it's native pointer
			// will be a KrollContext but we want to get back to our class
			JSStringRef prop = JSStringCreateWithUTF8CString("$native");
			if (!JSObjectHasProperty(ctx, function, prop)) {
				JSObjectSetProperty(ctx, function, prop, ref, kJSPropertyAttributeDontDelete | kJSPropertyAttributeDontEnum, 0);
			}
			JSStringRelease(prop);
			return function;
		}
	} else {
		return HLObjectMake(ctx, classRef, obj);
	}
}

/**
 * create a JS wrapper class for a given framework / class.  the pointer should be obj
 * returns a generic wrapper if not found
 */
static JSObjectRef CreateJSClassFromNSClass (NSString *framework, NSString *clsname, id obj, JSClassRef classRef) {
	NSString *path = [NSString stringWithFormat:@"/hyperloop/%@/%@", [framework lowercaseString], [clsname lowercaseString]];
	return CreateJSClassFromModulePath(path, obj, classRef, YES);
}

/**
 * for a given object, return a JSValueRef
 */
JSValueRef NSObjectToJSObject (id object) {

	JSObjectRef thisObject = HyperloopGetWrapperForId(object);
	if (thisObject != nil) return thisObject;

	if (!object || [object isEqual:[NSNull null]]) {
		return JSValueMakeNull(context.context);
	} else if ([object isKindOfClass:[NSNumber class]]) {
		return JSValueMakeNumber(context.context, [object doubleValue]);
	} else if ([object isKindOfClass:[HyperloopPointer class]]) {
		HyperloopPointer *pointer = (HyperloopPointer *)object;
		if (pointer.framework && pointer.classname) {
			// if this pointer has a framework and classname reference, we can return the JS wrapped class instance
			return CreateJSClassFromNSClass(pointer.framework, pointer.classname, object, pointerClassRef);
		}
		return HLObjectMake(context.context, pointerClassRef, object);
	} else if ([object isKindOfClass:[HyperloopClass class]]) {
		return HLObjectMake(context.context, classClassRef, object);
	} else {
		return HLObjectMake(context.context, constructorClassRef, object);
	}
	return JSValueMakeUndefined(context.context);
}

/**
 * return the current JSContextRef
 */
JSContextRef HyperloopCurrentContext () {
	return context.context;
}


#define CHECKEXCEPTION \
	if (exception && *exception != NULL) {\
		id ex = JSValueRefToId(ctx, *exception, NULL);\
		NSLog(@"[ERROR] JS Exception detected %@", ex);\
		return JSValueMakeUndefined(ctx); \
	}\

#define CHECKEXCEPTION_NSNULL \
	if (exception && *exception != NULL) {\
		id ex = JSValueRefToId(ctx, *exception, NULL);\
		NSLog(@"[ERROR] JS Exception detected %@", ex);\
		return [NSNull null];\
	}\

#define BEGIN_METHOD \
@autoreleasepool {\
@try {\

#define END_METHOD \
} @catch (NSException *ex) {\
  NSLog(@"[ERROR] %@", ex); \
  *exception = NSExceptionToJSException(ctx, ex);\
  return JSValueMakeUndefined(ctx); \
}\
}


#define JS_CALLBACK(name) \
static JSValueRef name (JSContextRef ctx, JSObjectRef function, JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[], JSValueRef *exception) {\
BEGIN_METHOD \

#define JS_CALLBACK_END \
END_METHOD \
}\

/**
 * convert a JSValueRef to an NSObject
 */
id JSValueRefToId (JSContextRef ctx, const JSValueRef value, JSValueRef *exception) {
	switch (JSValueGetType(ctx, value)) {
		case kJSTypeUndefined:
		case kJSTypeNull: {
			return [NSNull null];
		}
		case kJSTypeBoolean: {
			return [NSNumber numberWithBool:JSValueToBoolean(ctx, value)];
		}
		case kJSTypeNumber: {
			return [NSNumber numberWithDouble:JSValueToNumber(ctx, value, exception)];
		}
		case kJSTypeString: {
			return NSStringFromJSValueRef(ctx, value, exception);
		}
		case kJSTypeObject: {
			JSObjectRef obj = JSValueToObject(ctx, value, exception);
			CHECKEXCEPTION_NSNULL
			if (JSValueIsObjectOfClass(ctx, value, pointerClassRef) ||
				JSValueIsObjectOfClass(ctx, value, classClassRef) ||
				JSValueIsObjectOfClass(ctx, value, constructorClassRef)) {
				return (__bridge id)JSObjectGetPrivate(obj);
			} else if (HLValueIsDate(ctx, value)) {
				double ms = JSValueToNumber(ctx, value, exception);
				CHECKEXCEPTION_NSNULL
				return [NSDate dateWithTimeIntervalSince1970:(NSTimeInterval) (ms / 1000)];
			} else if (JSObjectIsFunction(ctx, obj)) {
				if (context == nil) {
					@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"argument passed was not a valid Hyperloop object" userInfo:nil];
				}
				return [KrollObject toID:context value:value];
			} else if (HLValueIsArray(ctx, obj)) {
				JSStringRef prop = JSStringCreateWithUTF8CString("length");
				JSValueRef lengthValue = JSObjectGetProperty(ctx, obj, prop, exception);
				CHECKEXCEPTION_NSNULL
				double len = JSValueToNumber(ctx, lengthValue, exception);
				CHECKEXCEPTION_NSNULL
				NSMutableArray *result = [NSMutableArray arrayWithCapacity:len];
				for (unsigned c = 0; c < len; c++) {
					JSValueRef val = JSObjectGetPropertyAtIndex(ctx, obj, c, exception);
					CHECKEXCEPTION_NSNULL
					id value = JSValueRefToId(ctx, val, exception);
					[result addObject:value];
				}
				JSStringRelease(prop);
				return result;
			} else if (isJSRegExp(ctx, obj, exception)) {
				NSRegularExpressionOptions options = 0;
				NSError *error = nil;
				JSStringRef source = JSStringCreateWithUTF8CString("source");
				JSValueRef sourceValue = JSObjectGetProperty(ctx, obj, source, exception);
				CHECKEXCEPTION_NSNULL
				if (TiPropToBool(ctx, obj, "multiline", exception)) {
					options |= NSRegularExpressionAnchorsMatchLines;
				}
				if (TiPropToBool(ctx, obj, "ignoreCase", exception)) {
					options |= NSRegularExpressionCaseInsensitive;
				}
				NSRegularExpression *re = [NSRegularExpression regularExpressionWithPattern:JSValueRefToId(ctx, sourceValue, exception) options:options error:&error];
				JSStringRelease(source);
				if (error) {
					if (exception) {
						*exception = NSErrorToJSException(ctx, error);
					}
					return [NSNull null];
				}
				return re;
			} else {
				// check to see if it's a KrollObject where we're receiving a Ti object
				// passed to Hyperloop
				void *p = JSObjectGetPrivate(obj);
				if (p) {
					id po = (__bridge id)p;
					if ([po isKindOfClass:[KrollObject class]]) {
						// check to see if this is a view proxy in which case we want to
						// wrap to the UIView itself and return it
						id target = [po performSelector:@selector(target)];
						if ([target isKindOfClass:[TiViewProxy class]]) {
							return [target performSelector:@selector(view)];
						}
						return target;
					}
					return po;
				}
				JSStringRef prop = JSStringCreateWithUTF8CString("$native");
				if (JSObjectHasProperty(ctx, obj, prop)) {
					JSValueRef nativeRef = JSObjectGetProperty(ctx, obj, prop, exception);
					CHECKEXCEPTION_NSNULL
					id nativeObj = JSValueRefToId(ctx, nativeRef, exception);
					CHECKEXCEPTION_NSNULL
					JSStringRelease(prop);
					return nativeObj;
				}
				JSStringRelease(prop);
				NSMutableDictionary *result = [NSMutableDictionary dictionary];
				JSPropertyNameArrayRef props = JSObjectCopyPropertyNames(ctx, obj);
				size_t len = JSPropertyNameArrayGetCount(props);
				for (unsigned c = 0; c < len; c++) {
					JSStringRef name = JSPropertyNameArrayGetNameAtIndex(props, c);
					JSValueRef val = JSObjectGetProperty(ctx, obj, name, exception);
					id value = JSValueRefToId(ctx, val, exception);
					[result setObject:value forKey:NSStringFromJSStringRef(ctx, name, exception)];
				}
				// if it looks like an exception, add the message to the output
				// FIXME: test for constructor instead
				if ([result objectForKey:@"line"] && [result objectForKey:@"column"]) {
					JSStringRef prop = JSStringCreateWithUTF8CString("message");
					JSValueRef val = JSObjectGetProperty(ctx, obj, prop, exception);
					id value = JSValueRefToId(ctx, val, exception);
					[result setObject:value forKey:NSStringFromJSStringRef(ctx, prop, exception)];
					JSStringRelease(prop);

					prop = JSStringCreateWithUTF8CString("stack");
					val = JSObjectGetProperty(ctx, obj, prop, exception);
					value = JSValueRefToId(ctx, val, exception);
					[result setObject:value forKey:NSStringFromJSStringRef(ctx, prop, exception)];
					JSStringRelease(prop);
				}
				JSPropertyNameArrayRelease(props);
				return result;
			}
		}
	}

	return [NSNull null];
}

/**
 * called when a new JS instance is created to retain the native object
 */
static void Initializer (JSContextRef ctx, JSObjectRef object) {
	id obj = (__bridge id)JSObjectGetPrivate(object);
	if (obj) {
		ARCRetain(obj);
#ifdef DEBUG_INITIALIZE
		NSLog(@"[HYPERLOOP] Initalizer %@ (%p)", [obj class], obj);
#endif
	}
}

/**
 * called when a new JS instance is garbage collected, need to release the native object
 */
static void Finalizer (JSObjectRef object) {
	id obj = (__bridge id)JSObjectGetPrivate(object);
	if (!obj) return;
#ifdef DEBUG_FINALIZE
	if ([obj isKindOfClass:[HyperloopClass class]]) {
		NSLog(@"[HYPERLOOP] Finalizer %@ %p", [[(HyperloopClass*)obj target]  class], [(HyperloopClass*)obj target]);
	} else if ([obj isKindOfClass:[HyperloopPointer class]]) {
		HyperloopPointer* p = (HyperloopPointer*)obj;
		if ([p objectValue]) {
			NSLog(@"[HYPERLOOP] Finalizer %@ %p", [[p objectValue] class], [p objectValue]);
		}
	} else if ([obj isKindOfClass:[KrollObject class]]) {
		NSLog(@"[HYPERLOOP] Finalizer %@ %p", [[obj target] class], [obj target]);
	}
#endif
	if (javaScriptWrappers != NULL) {
		CFStringRef key = (__bridge CFStringRef)HyperloopGetMemoryAddressOfId(obj);
		if (CFDictionaryContainsKey(javaScriptWrappers, key)) {
			CFDictionaryRemoveValue(javaScriptWrappers, key);
		}
	}
	ARCRelease(obj);
}

/**
 * called when a new JS wrapper is constructed
 */
static JSObjectRef Constructor (JSContextRef ctx, JSObjectRef constructor, size_t argumentCount, const JSValueRef arguments[], JSValueRef* exception) {
	id obj;
	if (argumentCount) {
		obj = JSValueRefToId(ctx, arguments[0], exception);
	} else {
		HyperloopClass *cls = (__bridge HyperloopClass *)JSObjectGetPrivate(constructor);
		Class customClass = (Class)[cls target];
		obj = [[customClass alloc] init];
		if (cls.customClass) {
			return CreateJSClassFromNSClass(@"hyperloop", NSStringFromClass(cls.customClass), obj, constructorClassRef);
		}
	}
	return HLObjectMake(ctx, constructorClassRef, obj);
}

#define CHECKVAL(var) \
	if (var == nil) { \
		NSString *message = [NSString stringWithFormat:@"property %s is required", STR(var)];\
		@throw [NSException exceptionWithName:@"InvalidArgument" reason:message userInfo:nil];\
	}\

/**
 * forces a garbage collection, this is called from JavaScript, `Hyperloop.garbageCollect()`
 */
#if TARGET_OS_SIMULATOR
JS_CALLBACK(GarbageCollect)
	NSLog(@"[HYPERLOOP] 🚚\tGarbage Collection");
	JSSynchronousGarbageCollectForDebugging(ctx);
	return JSValueMakeUndefined(ctx);
JS_CALLBACK_END
#endif

JS_CALLBACK(GetWrapper)
	JSObjectRef thisObject = JSValueToObject(ctx, arguments[0], exception);
	CHECKEXCEPTION
	id nativePointer = (__bridge id)(JSObjectGetPrivate(thisObject));
	if (nativePointer == nil) {
		return JSValueMakeUndefined(ctx);
	}

	JSValueRef result = HyperloopGetWrapperForId(nativePointer);
	if (result == NULL) {
		return JSValueMakeUndefined(ctx);
	}
	// if ([nativePointer isKindOfClass:[HyperloopClass class]] || [nativePointer isKindOfClass:[KrollObject class]]) {
	// 	NSLog(@"[HYPERLOOP] GetWrapper %@ %p", [[nativePointer target] class], [nativePointer target]);
	// }
	return result;
JS_CALLBACK_END

/**
 * stores the javascript wrapper inside the `javaScriptWrappers` dictionary.
 */


/**
 * if (ti_proxy) {
 *	wrapper.$native.__TI.__$internal__ = wrapper
 * } else {
 *	wrapper.$native.__$internal__ = wrapper
 * }
 */

JS_CALLBACK(RegisterWrapper)
	JSObjectRef thisObject = JSValueToObject(ctx, arguments[0], exception);
	CHECKEXCEPTION
	id nativePointer = nil;
	{
		JSStringRef str;
		JSObjectRef jsObject;
		{
			str = JSStringCreateWithUTF8CString("$native");
			JSValueRef value = JSObjectGetProperty(ctx, thisObject, str, exception);
			JSStringRelease(str);
			CHECKEXCEPTION
			jsObject = JSValueToObject(ctx, value, exception);
			CHECKEXCEPTION;
		}

		nativePointer = (__bridge id)(JSObjectGetPrivate(jsObject));
		{
			str = JSStringCreateWithUTF8CString("__wrapper__");
			if ([nativePointer isKindOfClass:[KrollObject class]]) {
				jsObject = [(KrollObject*)nativePointer propsObject];
			}
			JSObjectSetProperty(ctx, jsObject, str, thisObject, kJSPropertyAttributeDontDelete, exception);
			JSStringRelease(str);
			CHECKEXCEPTION;
		}

		// if ([nativePointer isKindOfClass:[HyperloopClass class]] || [nativePointer isKindOfClass:[KrollObject class]]) {
		// 	NSLog(@"[HYPERLOOP] RegisterWrapper %@ %p", [[nativePointer target] class], [nativePointer target]);
		// }
	}
	HyperloopRegisterWrapper(nativePointer, thisObject);
	return JSValueMakeUndefined(ctx);
JS_CALLBACK_END

/**
 * create a new Class proxy
 */
JS_CALLBACK(NewProxy)
	NSDictionary *properties = JSValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	NSString *cls = [properties valueForKey:@"class"];
	NSString *init = [properties valueForKey:@"init"];
	NSNumber *alloc = [properties valueForKey:@"alloc"];
	CHECKVAL(cls);
	CHECKVAL(init)
	CHECKVAL(alloc)
	NSArray *args = [properties valueForKey:@"args"];
	if ([args isEqual:[NSNull null]]) {
		args = nil;
	}
	HyperloopClass *newClass = [[HyperloopClass alloc] initWithClassName:cls alloc: [alloc boolValue] init:NSSelectorFromString(init) args:args];

	// if ([alloc boolValue]) {
	// 	NSLog(@"[HYPERLOOP] NewProxy %@ %p", [[(HyperloopClass*)newClass target] class], [(HyperloopClass*)newClass target]);
	// } else {
	//	NSLog(@"[HYPERLOOP] NewProxy [%@ class] %p", [[(HyperloopClass*)newClass target] class], [(HyperloopClass*)newClass target]);
	// }
	return HLObjectMake(ctx, classClassRef, newClass);
JS_CALLBACK_END

/**
 * create a new Pointer
 */
JS_CALLBACK(CreatePointer)
	NSString *encoding = JSValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	HyperloopPointer *pointer = [HyperloopPointer encoding:[encoding UTF8String]];
	if (argumentCount == 3) {
		NSString *framework = JSValueRefToId(ctx, arguments[1], exception);
		CHECKEXCEPTION
		NSString *classname = JSValueRefToId(ctx, arguments[2], exception);
		CHECKEXCEPTION
		return CreateJSClassFromNSClass(framework, classname, pointer, pointerClassRef);
	}
	return HLObjectMake(ctx, pointerClassRef, pointer);
JS_CALLBACK_END

/**
 * dispatch a method / property call
 */
JS_CALLBACK(Dispatch)
	if (argumentCount < 2) {
		@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"you must pass at least 2 arguments to dispatch" userInfo:nil];
	}
	NSString *selector = NSStringFromJSValueRef(ctx, arguments[1], exception);
	CHECKEXCEPTION
	id args = argumentCount > 2 ? JSValueRefToId(ctx, arguments[2], exception) : nil;
	CHECKEXCEPTION

	id target = JSValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION

	if ([args isEqual:[NSNull null]]) {
		args = nil;
	}
	// dispatch can take just one argument, in which case, we need to turn it into an array of 1
	if (args && [args isKindOfClass:[NSArray class]] == NO) {
		args = @[args];
	}
	BOOL isInstance = argumentCount > 3 ? JSValueToBoolean(ctx, arguments[3]) : YES;
	id result = [HyperloopUtils invokeSelector:NSSelectorFromString(selector) args:args target:target instance:isInstance];
	if (result == nil || [result isEqual:[NSNull null]]) {
		return JSValueMakeNull(ctx);
	}
	// NSLog(@"[DEBUG] dispatch %@ %@", target, selector);
	if ([result isKindOfClass:[HyperloopPointer class]]) {
#ifdef TIMODULE
		id obj = [(HyperloopPointer *)result objectValue];
		// we need to return the container if we're trying to get the UIView contained by the Hyperloop View
		if (obj && [obj isKindOfClass:[UIView class]] && [[(UIView *)obj superview] isKindOfClass:[HyperloopView class]]) {
			obj = [obj superview];
			result = [HyperloopPointer pointer:(__bridge void *)(obj) encoding:@encode(id)];
		}
#endif
		return HLObjectMake(ctx, pointerClassRef, result);
	} else if ([result isKindOfClass:[NSNumber class]]) {
		return JSValueMakeNumber(ctx, [result doubleValue]);
	}
	return JSValueMakeUndefined(ctx);
JS_CALLBACK_END

/**
 * define a custom class
 */
JS_CALLBACK(DefineClass)
	if (argumentCount < 1) {
		@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"you must pass at least 1 arguments to DefineClass" userInfo:nil];
	}
	// no-op since the bulk of the work is done at compile time
	NSString *name = JSValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:name alloc:NO init:@selector(class) args:nil];
	cls.customClass = NSClassFromString(name);

	Class classMapping = NSClassFromString(@"HyperloopCustomClassMapping");
	if (classMapping) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"
		NSString *modulePath = [classMapping performSelector:@selector(mappingForClass:) withObject:name];
#pragma clang diagnostic pop
		return CreateJSClassFromModulePath(modulePath, cls, classClassRef, NO);
	}
	return HLObjectMake(ctx, classClassRef, cls);
JS_CALLBACK_END

/**
 * dynamically add a method to a class
 */
JS_CALLBACK(AddMethod)
	id targetClass = JSValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	NSDictionary *props = JSValueRefToId(ctx, arguments[1], exception);
	CHECKEXCEPTION
	BOOL isInstance = [props objectForKey:@"instance"] ? [HyperloopUtils booleanify:[props objectForKey:@"instance"]] : YES;
	HyperloopClass *cls = (HyperloopClass *)targetClass;
	NSString *classname = NSStringFromClass([[cls target] class]);
	NSString *selector = [props objectForKey:@"selector"];
	KrollCallback *callback = [props objectForKey:@"callback"];

	// generate the identifier
	NSString *identifier = GenerateIdentifier(classname, selector, isInstance);

	// register only once if not already registered
	if (!callbacks || [callbacks objectForKey:identifier] == nil) {
		HyperloopRegisterCallbackForIdentifier(callback, identifier);
	}

	return JSValueMakeNull(ctx);
JS_CALLBACK_END

/**
 * return true if object is of type [NSNull class]
 */
JS_CALLBACK(IsNull)
	id target = JSValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	if (!target || [target isEqual:[NSNull null]]) {
		return JSValueMakeBoolean(ctx, YES);
	}
	return JSValueMakeBoolean(ctx, NO);
JS_CALLBACK_END

/**
 * protect the passed in JS value from garbage collection
 */
JS_CALLBACK(Protect)
	JSValueProtect(ctx, arguments[0]);
	return JSValueMakeBoolean(ctx, YES);
JS_CALLBACK_END

/**
 * unprotect the passed in JS value so that it can be garbage collected
 */
JS_CALLBACK(Unprotect)
	JSValueUnprotect(ctx, arguments[0]);
	return JSValueMakeBoolean(ctx, YES);
JS_CALLBACK_END

/**
 * logger utility which will correctly handle serialization of JS / native objects
 */
JS_CALLBACK(Logger)
	NSMutableArray *array = [NSMutableArray arrayWithCapacity:argumentCount];
	for (size_t c = 0; c < argumentCount; c++) {
		JSStringRef s = JSValueToStringCopy(ctx, arguments[c], exception);
		CHECKEXCEPTION
		NSString *str = NSStringFromJSStringRef(ctx, s, exception);
		CHECKEXCEPTION
		[array addObject:str];
	}
	NSLog(@"[INFO] %@", [array componentsJoinedByString:@" "]);
	return JSValueMakeNull(ctx);
JS_CALLBACK_END

/**
 * coerce is JS value from one type to another
 */
static JSValueRef Convert (JSContextRef ctx, JSObjectRef object, JSType type, JSValueRef* exception) {
	id ref = (__bridge id)(JSObjectGetPrivate(object));
	switch (type) {
		case kJSTypeUndefined: {
			return JSValueMakeUndefined(ctx);
		}
		case kJSTypeNull: {
			return JSValueMakeNull(ctx);
		}
		case kJSTypeBoolean: {
			if ([ref respondsToSelector:@selector(boolValue)]) {
				return JSValueMakeBoolean(ctx, [ref boolValue]);
			}
			return JSValueMakeBoolean(ctx, false);
		}
		case kJSTypeNumber: {
			if ([ref respondsToSelector:@selector(doubleValue)]) {
				return JSValueMakeNumber(ctx, [ref doubleValue]);
			}
			return JSValueMakeNumber(ctx, NAN);
		}
		case kJSTypeString: {
			JSStringRef str = JSStringCreateWithUTF8CString([[ref description] UTF8String]);
			JSValueRef result = JSValueMakeString(ctx, str);
			JSStringRelease(str);
			return result;
		}
		case kJSTypeObject: {
			return object;
		}
	}

	return JSValueMakeUndefined(ctx);
}

/**
 * stringify a JS object
 */
static JSValueRef String (JSContextRef ctx, JSObjectRef function, JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[], JSValueRef *exception) {
	@autoreleasepool {
		if (JSValueIsObject(ctx, arguments[0])) {
			JSObjectRef obj = JSValueToObject(ctx, arguments[0], exception);
			CHECKEXCEPTION
			id target = (__bridge id)(JSObjectGetPrivate(obj));
			if (target) {
				JSStringRef str = JSStringCreateWithUTF8CString([[target description] UTF8String]);
				JSValueRef result = JSValueMakeString(ctx, str);
				JSStringRelease(str);
				return result;
			}
			return Convert(ctx, obj, kJSTypeString, exception);
		} else if (JSValueIsString(ctx, arguments[0])) {
			return arguments[0];
		} else if (JSValueIsBoolean(ctx, arguments[0])) {
			if (JSValueToBoolean(ctx, arguments[0])) {
				JSStringRef str = JSStringCreateWithUTF8CString("true");
				JSValueRef result = JSValueMakeString(ctx, str);
				JSStringRelease(str);
				return result;
			} else {
				JSStringRef str = JSStringCreateWithUTF8CString("false");
				JSValueRef result = JSValueMakeString(ctx, str);
				JSStringRelease(str);
				return result;
			}
		} else if (JSValueIsNumber(ctx, arguments[0])) {
			double n = JSValueToNumber(ctx, arguments[0], exception);
			CHECKEXCEPTION
			NSNumber *num = [NSNumber numberWithDouble:n];
			JSStringRef str = JSStringCreateWithUTF8CString([[num stringValue] UTF8String]);
			JSValueRef result = JSValueMakeString(ctx, str);
			JSStringRelease(str);
			return result;
		} else {
			return JSValueMakeNull(ctx);
		}
	}
}

#define GETNUMVALUE(type, name, fn, def) \
JS_CALLBACK(name)\
	if (JSValueIsObject(ctx, arguments[0])) {\
		JSObjectRef obj = JSValueToObject(ctx, arguments[0], exception);\
		CHECKEXCEPTION\
		id target = (__bridge id)JSObjectGetPrivate(obj);\
		NSNumber *result = [NSNumber numberWith##name:[HyperloopPointer type##Value:target]];\
		return fn(ctx, [result type##Value]); \
	} else if (JSValueIsBoolean(ctx, arguments[0])) {\
		return fn(ctx, JSValueToBoolean(ctx, arguments[0]));\
	} else if (JSValueIsNumber(ctx, arguments[0])) { \
		return fn(ctx, JSValueToNumber(ctx, arguments[0], exception));\
	}\
	return JSValueMakeBoolean(ctx, def);\
JS_CALLBACK_END

GETNUMVALUE(bool, Bool, JSValueMakeBoolean, false);
GETNUMVALUE(float, Float, JSValueMakeNumber, NAN);
GETNUMVALUE(int, Int, JSValueMakeNumber, NAN);
GETNUMVALUE(short, Short, JSValueMakeNumber, NAN);
GETNUMVALUE(double, Double, JSValueMakeNumber, NAN);
GETNUMVALUE(long, Long, JSValueMakeNumber, NAN);
GETNUMVALUE(longLong, LongLong, JSValueMakeNumber, NAN);
GETNUMVALUE(char, Char, JSValueMakeNumber, NAN);
GETNUMVALUE(unsignedInt, UnsignedInt, JSValueMakeNumber, NAN);
GETNUMVALUE(unsignedLong, UnsignedLong, JSValueMakeNumber, NAN);
GETNUMVALUE(unsignedLongLong, UnsignedLongLong, JSValueMakeNumber, NAN);
GETNUMVALUE(unsignedShort, UnsignedShort, JSValueMakeNumber, NAN);
GETNUMVALUE(unsignedChar, UnsignedChar, JSValueMakeNumber, NAN);

// directly from titanium_prep
extern NSString * const TI_APPLICATION_GUID;
extern NSString * const TI_APPLICATION_DEPLOYTYPE;

@implementation Hyperloop

/**
 * this method is called before Titanium loads to allow Hyperloop to bootstrap into the JS VM
 */
+(void)willStartNewContext:(KrollContext *)kroll bridge:(KrollBridge *)krollbridge {
// NSLog(@"[TRACE][HYPERLOOP] willStartNewContext %@", kroll);

	// Release objects belonging to last context. (Will only happen if LiveView restarts app's JS runtime.)
	HyperloopRelease();

	context = kroll;
	bridge = krollbridge;
	JSGlobalContextRef ctx = (JSGlobalContextRef)[kroll context];
	JSGlobalContextRetain(ctx);

	// create our hyperloop class
	JSClassDefinition classDef = kJSClassDefinitionEmpty;
	classDef.className = "Hyperloop";
	classDef.initialize = Initializer;
	classDef.finalize = Finalizer;
	classDef.convertToType = Convert;
	objectClassRef = JSClassCreate(&classDef);


	classDef.className = "HyperloopPointer";
	pointerClassRef = JSClassCreate(&classDef);

	JSObjectRef globalObjectRef = JSContextGetGlobalObject(ctx);
	JSValueRef exception = NULL;

	// create our base constructor
	classDef.className = "HyperloopObject";
	classDef.callAsConstructor = Constructor;
	constructorClassRef = JSClassCreate(&classDef);

	JSStaticFunction StaticFunctionsArray [] = {
		{ "addMethod", AddMethod,
			kJSPropertyAttributeReadOnly | kJSPropertyAttributeDontEnum | kJSPropertyAttributeDontDelete },
		NULL
	};

	classDef.staticFunctions = StaticFunctionsArray;
	classDef.className = "HyperloopClass";
	classClassRef = JSClassCreate(&classDef);

	JSStringRef constructorProp = JSStringCreateWithUTF8CString("HyperloopObject");
	JSObjectRef constructor = HLObjectMake(ctx, constructorClassRef, 0);
	JSObjectSetProperty(ctx, globalObjectRef, constructorProp, constructor, kJSPropertyAttributeDontDelete, &exception);
	assert(exception==NULL);

	// register it with the Global Context
	JSStringRef href = JSStringCreateWithUTF8CString("Hyperloop");
	JSObjectRef objectRef = HLObjectMake(ctx, objectClassRef, context);
	assert(exception==NULL);

	#define MAKECALLBACK(name, fn) \
	{\
		JSStringRef ref##name = JSStringCreateWithUTF8CString(STR(name));\
		JSObjectRef newProxy##name = JSObjectMakeFunctionWithCallback(ctx, ref##name, fn);\
		JSObjectSetProperty(ctx, objectRef, ref##name, newProxy##name, kJSPropertyAttributeReadOnly | kJSPropertyAttributeDontEnum | kJSPropertyAttributeDontDelete, &exception);\
		JSStringRelease(ref##name);\
		assert(exception==NULL);\
	}\

	// add our implementations


#if TARGET_OS_SIMULATOR
	MAKECALLBACK(garbageCollect, GarbageCollect);
#endif
	MAKECALLBACK(getWrapper, GetWrapper);
	MAKECALLBACK(registerWrapper, RegisterWrapper);
	MAKECALLBACK(createProxy, NewProxy);
	MAKECALLBACK(createPointer, CreatePointer);
	MAKECALLBACK(defineClass, DefineClass);
	MAKECALLBACK(addMethod, AddMethod);
	MAKECALLBACK(dispatch, Dispatch);
	MAKECALLBACK(isNull, IsNull);
	MAKECALLBACK(protect, Protect);
	MAKECALLBACK(unprotect, Unprotect);
	MAKECALLBACK(stringValue, String);
	MAKECALLBACK(log, Logger);


	#define DEFINENUM(type,name) \
	{\
		JSStringRef ref##name = JSStringCreateWithUTF8CString(STR(type##Value));\
		JSObjectRef fn##name = JSObjectMakeFunctionWithCallback(ctx, ref##name, name);\
		JSObjectSetProperty(ctx, objectRef, ref##name, fn##name, kJSPropertyAttributeReadOnly | kJSPropertyAttributeDontEnum | kJSPropertyAttributeDontDelete, &exception);\
		JSStringRelease(ref##name);\
		assert(exception==NULL);\
	}\

	// add our convertors

	DEFINENUM(bool, Bool);
	DEFINENUM(float, Float);
	DEFINENUM(int, Int);
	DEFINENUM(short, Short);
	DEFINENUM(double, Double);
	DEFINENUM(long, Long);
	DEFINENUM(longLong, LongLong);
	DEFINENUM(char, Char);
	DEFINENUM(unsignedInt, UnsignedInt);
	DEFINENUM(unsignedLong, UnsignedLong);
	DEFINENUM(unsignedLongLong, UnsignedLongLong);
	DEFINENUM(unsignedShort, UnsignedShort);
	DEFINENUM(unsignedChar, UnsignedChar);


	// now set the object and seal it
	JSObjectSetProperty(ctx, globalObjectRef, href, objectRef, kJSPropertyAttributeReadOnly | kJSPropertyAttributeDontEnum | kJSPropertyAttributeDontDelete, &exception);
	JSValueProtect(ctx, objectRef);
	JSStringRelease(href);
	assert(exception==NULL);
}

/**
 * this method is called after Titanium starts the context
 */
+(void)didStartNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge{
// NSLog(@"[TRACE][HYPERLOOP] didStartNewContext %@", kroll);
}


/**
 * this method is called before Titanium shuts down the context
 */
+(void)willStopNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge{
// NSLog(@"[TRACE][HYPERLOOP] willStopNewContext %@", kroll);
	HyperloopRelease();
}

/**
 * this method is called after Titanium stops the context
 */
+(void)didStopNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge{
// NSLog(@"[TRACE][HYPERLOOP] didStopNewContext %@", kroll);
}

+(JSObjectRef)createPointer:(HyperloopPointer *)pointer {
	return HLObjectMake(context.context, pointerClassRef, pointer);
}

+(NSException *)JSValueRefToNSException:(JSValueRef)exception {
	NSDictionary *dictionary = JSValueRefToId(context.context, exception, 0);
	return [NSException exceptionWithName:@"Exception" reason:[dictionary objectForKey:@"message"] userInfo:dictionary];
}

@end

#ifdef TIMODULE
// define a module such that it can be resolved if required

@interface HyperloopModule : TiModule
@end

@implementation HyperloopModule

#pragma - mark Hyperloop

// this is generated for your module, please do not change it
-(id)moduleGUID {
	return @"bdaca69f-b316-4ce6-9065-7a61e1dafa39";
}

// this is generated for your module, please do not change it
-(NSString*)moduleId {
	return @"hyperloop";
}

@end
#endif
