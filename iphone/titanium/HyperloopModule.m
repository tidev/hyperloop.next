/**
 * Hyperloop Module
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#import "HyperloopModule.h"
#import "define.h"
#import "class.h"
#import "pointer.h"
#import "utils.h"

#ifdef TIMODULE
#import "TiToJS.h"
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
		-(TiContextRef)context;
	@end
	@interface KrollBridge : NSObject
		-(id)require:(KrollContext*)kroll path:(NSString*)path;
	@end
	@interface KrollObject : NSObject
		+(id)toID:(KrollContext *)c value:(TiValueRef)ref;
		-(TiObjectRef) propsObject;
	@end
	@interface KrollWrapper : NSObject
		@property (nonatomic,readwrite,assign)	TiObjectRef jsobject;
	@end
	@interface KrollCallback : NSObject
	@end
	@interface TiViewProxy : NSObject
		@property(nonatomic,readwrite,retain) UIView * view;
	@end
#endif

#if TARGET_OS_SIMULATOR
extern void JSSynchronousGarbageCollectForDebugging(TiContextRef);
#endif

static TiClassRef classClassRef;
static TiClassRef pointerClassRef;
static TiClassRef constructorClassRef;
static TiClassRef objectClassRef;
static KrollContext *context = nil;
static KrollBridge *bridge = nil;
static NSMutableDictionary <NSString *, KrollCallback *> * callbacks = nil;
static NSMutableDictionary <NSString *, KrollWrapper *> * modules = nil;
static CFMutableDictionaryRef javaScriptWrappers = NULL;

static NSString* HyperloopGetMemoryAddressOfId(id data);
static void HyperloopRegisterWrapper(id pointer, TiValueRef thisObject);
static TiObjectRef HLObjectMake(TiContextRef ctx, TiClassRef cls, id obj);
TiObjectRef HyperloopGetWrapperForId(id obj);

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
static void HyperloopRegisterWrapper (id pointer, TiValueRef thisObject) {
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
TiObjectRef HyperloopGetWrapperForId (id obj) {
	if (javaScriptWrappers == NULL || obj == nil) { return NULL; }

	CFStringRef key = (__bridge CFStringRef)HyperloopGetMemoryAddressOfId(obj);
	TiObjectRef result = NULL;
	if (CFDictionaryContainsKey(javaScriptWrappers, key)) {
		result = (TiObjectRef)CFDictionaryGetValue(javaScriptWrappers, key);
	}
	return result;
}

/**
 * replacement function for creating JS Objects. It looks for a wrapper in the `javaScriptWrappers` and
 * returns it if found, otherwise calls `TiObjectMake`
 */
static TiObjectRef HLObjectMake (TiContextRef ctx, TiClassRef cls, id obj) {
	TiObjectRef jsObject = HyperloopGetWrapperForId(obj);
	if (jsObject != nil) {
#ifdef TIMODULE
		if ([[obj nativeObject] isKindOfClass:[HyperloopView class]]) {
			// Special case. If this is a UIView attached to a Titanium view, then grab the Titnaium view that owns it
			TiStringRef prop = TiStringCreateWithUTF8CString("$native");
			if (TiObjectHasProperty(ctx, jsObject, prop)) {
				TiObjectSetProperty(ctx, jsObject, prop, TiObjectMake(ctx, pointerClassRef, (__bridge void *)(obj)), kTiPropertyAttributeNone, NULL);
			}
			TiStringRelease(prop);
			}
#endif
		// NSLog(@"[HYPERLOOP] Recycling object %@", [obj class]);
		return jsObject;
	}
	return TiObjectMake(ctx, cls, (__bridge void *)(obj));
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
 * convert a TiStringRef into a NSString *
 */
static NSString* NSStringFromTiStringRef (TiContextRef ctx, TiStringRef string, TiValueRef *exception) {
	CFStringRef str = TiStringCopyCFString(NULL, string);
	NSString* nsstring = [NSString stringWithString: (__bridge NSString *)str];
	CFRelease(str);
	return nsstring;
}

/**
 * convert a TiValueRef into a NSString *
 */
static NSString* NSStringFromTiValueRef (TiContextRef ctx, TiValueRef value, TiValueRef *exception) {
	TiStringRef string = TiValueToStringCopy(ctx, value, exception);
	return NSStringFromTiStringRef(ctx, string, exception);
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
 * returns true if TiObjectRef is a JS RegExp instance
 */
BOOL isJSRegExp (TiContextRef ctx, TiObjectRef obj, TiValueRef *exception) {
	TiStringRef script = TiStringCreateWithUTF8CString("RegExp");
	TiObjectRef global = TiContextGetGlobalObject(ctx);
	TiValueRef classRef = TiObjectGetProperty(ctx, global, script, exception);
	TiObjectRef classObj = TiValueToObject(ctx, classRef, exception);
	TiStringRelease(script);
	return TiValueIsInstanceOfConstructor(ctx, obj, classObj, exception);
}

/**
 * returns the property for the TiObjectRef as a boolean or false if not found
 */
static BOOL TiPropToBool (TiContextRef ctx, TiObjectRef obj, const char *prop, TiValueRef *exception) {
	TiStringRef propString = TiStringCreateWithUTF8CString(prop);
	TiValueRef value = TiObjectGetProperty(ctx, obj, propString, exception);
	TiStringRelease(propString);
	if (TiValueIsBoolean(ctx, value)) {
		return TiValueToBoolean(ctx, value);
	}
	return false;
}

/**
 * returns an NSError as a JS Error object
 */
static TiValueRef NSErrorToJSException (TiContextRef ctx, NSError *exception) {
	TiStringRef message = TiStringCreateWithUTF8CString([[exception localizedDescription] UTF8String]);
	TiValueRef args[1];
	args[0] = TiValueMakeString(ctx, message);
	TiObjectRef result = TiObjectMakeError(ctx, 1, args, NULL);
	TiValueRef messageRef = TiValueMakeString(ctx, message);
	TiStringRef prop = TiStringCreateWithUTF8CString("description");
	TiObjectSetProperty(ctx, result, prop, messageRef, kTiPropertyAttributeReadOnly, NULL);
	TiStringRelease(message);
	TiStringRelease(prop);
	prop = TiStringCreateWithUTF8CString("name");
	message = TiStringCreateWithUTF8CString([[exception domain] UTF8String]);
	messageRef = TiValueMakeString(ctx, message);
	TiObjectSetProperty(ctx, result, prop, messageRef, kTiPropertyAttributeReadOnly, NULL);
	TiStringRelease(message);
	TiStringRelease(prop);
	NSArray *array = [NSThread callStackSymbols];
	array = [array subarrayWithRange:NSMakeRange(1, [array count] - 1)];
	NSString *stack = [array componentsJoinedByString:@"\n"];
	message = TiStringCreateWithUTF8CString([stack UTF8String]);
	prop = TiStringCreateWithUTF8CString("nativeStack");
	messageRef = TiValueMakeString(ctx, message);
	TiObjectSetProperty(ctx, result, prop, messageRef, kTiPropertyAttributeReadOnly, NULL);
	TiStringRelease(message);
	TiStringRelease(prop);
	return result;
}

/**
 * returns an NSException as a JS Error object
 */
static TiValueRef NSExceptionToJSException (TiContextRef ctx, NSException *exception) {
	TiStringRef message = TiStringCreateWithUTF8CString([[exception reason] UTF8String]);
	TiValueRef args[1];
	args[0] = TiValueMakeString(ctx, message);
	TiObjectRef result = TiObjectMakeError(ctx, 1, args, NULL);
	TiValueRef messageRef = TiValueMakeString(ctx, message);
	TiStringRef prop = TiStringCreateWithUTF8CString("description");
	TiObjectSetProperty(ctx, result, prop, messageRef, kTiPropertyAttributeReadOnly, NULL);
	TiStringRelease(message);
	TiStringRelease(prop);
	prop = TiStringCreateWithUTF8CString("name");
	message = TiStringCreateWithUTF8CString([[exception name] UTF8String]);
	messageRef = TiValueMakeString(ctx, message);
	TiObjectSetProperty(ctx, result, prop, messageRef, kTiPropertyAttributeReadOnly, NULL);
	TiStringRelease(message);
	TiStringRelease(prop);
	NSArray *array = [exception callStackSymbols];
	array = [array subarrayWithRange:NSMakeRange(1, [array count] - 1)];
	NSString *stack = [array componentsJoinedByString:@"\n"];
	message = TiStringCreateWithUTF8CString([stack UTF8String]);
	prop = TiStringCreateWithUTF8CString("nativeStack");
	messageRef = TiValueMakeString(ctx, message);
	TiObjectSetProperty(ctx, result, prop, messageRef, kTiPropertyAttributeReadOnly, NULL);
	TiStringRelease(message);
	TiStringRelease(prop);
	return result;
}

/**
 * attempt to get a class wrapper
 */
static TiObjectRef CreateJSClassFromModulePath (NSString *path, id obj, TiClassRef classRef, BOOL newInstance) {
	TiContextRef ctx = context.context;
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
		TiObjectRef function = [wrapper jsobject];
		TiObjectRef ref = HLObjectMake(ctx, pointerClassRef, obj);
		if (newInstance) {
			TiValueRef args [] = {ref};
			return TiObjectCallAsConstructor(ctx, function, 1, args, NULL);
		} else {
			// we need to store our pointer since this is a KrollWrapper and it's native pointer
			// will be a KrollContext but we want to get back to our class
			TiStringRef prop = TiStringCreateWithUTF8CString("$native");
			if (!TiObjectHasProperty(ctx, function, prop)) {
				TiObjectSetProperty(ctx, function, prop, ref, kTiPropertyAttributeDontDelete | kTiPropertyAttributeDontEnum, 0);
			}
			TiStringRelease(prop);
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
static TiObjectRef CreateJSClassFromNSClass (NSString *framework, NSString *clsname, id obj, TiClassRef classRef) {
	NSString *path = [NSString stringWithFormat:@"hyperloop/%@/%@", [framework lowercaseString], [clsname lowercaseString]];
	return CreateJSClassFromModulePath(path, obj, classRef, YES);
}

/**
 * for a given object, return a TiValueRef
 */
TiValueRef NSObjectToJSObject (id object) {

	TiObjectRef thisObject = HyperloopGetWrapperForId(object);
	if (thisObject != nil) return thisObject;

	if (!object || [object isEqual:[NSNull null]]) {
		return TiValueMakeNull(context.context);
	} else if ([object isKindOfClass:[NSNumber class]]) {
		return TiValueMakeNumber(context.context, [object doubleValue]);
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
	return TiValueMakeUndefined(context.context);
}

/**
 * return the current TiContextRef
 */
TiContextRef HyperloopCurrentContext () {
	return context.context;
}


#define CHECKEXCEPTION \
	if (exception && *exception != NULL) {\
		id ex = TiValueRefToId(ctx, *exception, NULL);\
		NSLog(@"[ERROR] JS Exception detected %@", ex);\
		return TiValueMakeUndefined(ctx); \
	}\

#define CHECKEXCEPTION_NSNULL \
	if (exception && *exception != NULL) {\
		id ex = TiValueRefToId(ctx, *exception, NULL);\
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
  return TiValueMakeUndefined(ctx); \
}\
}


#define JS_CALLBACK(name) \
static TiValueRef name (TiContextRef ctx, TiObjectRef function, TiObjectRef thisObject, size_t argumentCount, const TiValueRef arguments[], TiValueRef *exception) {\
BEGIN_METHOD \

#define JS_CALLBACK_END \
END_METHOD \
}\

/**
 * convert a TiValueRef to an NSObject
 */
id TiValueRefToId (TiContextRef ctx, const TiValueRef value, TiValueRef *exception) {
	switch (TiValueGetType(ctx, value)) {
		case kTITypeUndefined:
		case kTITypeNull: {
			return [NSNull null];
		}
		case kTITypeBoolean: {
			return [NSNumber numberWithBool:TiValueToBoolean(ctx, value)];
		}
		case kTITypeNumber: {
			return [NSNumber numberWithDouble:TiValueToNumber(ctx, value, exception)];
		}
		case kTITypeString: {
			return NSStringFromTiValueRef(ctx, value, exception);
		}
		case kTITypeObject: {
			TiObjectRef obj = TiValueToObject(ctx, value, exception);
			CHECKEXCEPTION_NSNULL
			if (TiValueIsObjectOfClass(ctx, value, pointerClassRef) ||
				TiValueIsObjectOfClass(ctx, value, classClassRef) ||
				TiValueIsObjectOfClass(ctx, value, constructorClassRef)) {
				return (__bridge id)TiObjectGetPrivate(obj);
			} else if (HLValueIsDate(ctx, value)) {
				double ms = TiValueToNumber(ctx, value, exception);
				CHECKEXCEPTION_NSNULL
				return [NSDate dateWithTimeIntervalSince1970:(NSTimeInterval) (ms / 1000)];
			} else if (TiObjectIsFunction(ctx, obj)) {
				if (context == nil) {
					@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"argument passed was not a valid Hyperloop object" userInfo:nil];
				}
				return [KrollObject toID:context value:value];
			} else if (HLValueIsArray(ctx, obj)) {
				TiStringRef prop = TiStringCreateWithUTF8CString("length");
				TiValueRef lengthValue = TiObjectGetProperty(ctx, obj, prop, exception);
				CHECKEXCEPTION_NSNULL
				double len = TiValueToNumber(ctx, lengthValue, exception);
				CHECKEXCEPTION_NSNULL
				NSMutableArray *result = [NSMutableArray arrayWithCapacity:len];
				for (unsigned c = 0; c < len; c++) {
					TiValueRef val = TiObjectGetPropertyAtIndex(ctx, obj, c, exception);
					CHECKEXCEPTION_NSNULL
					id value = TiValueRefToId(ctx, val, exception);
					[result addObject:value];
				}
				TiStringRelease(prop);
				return result;
			} else if (isJSRegExp(ctx, obj, exception)) {
				NSRegularExpressionOptions options = 0;
				NSError *error = nil;
				TiStringRef source = TiStringCreateWithUTF8CString("source");
				TiValueRef sourceValue = TiObjectGetProperty(ctx, obj, source, exception);
				CHECKEXCEPTION_NSNULL
				if (TiPropToBool(ctx, obj, "multiline", exception)) {
					options |= NSRegularExpressionAnchorsMatchLines;
				}
				if (TiPropToBool(ctx, obj, "ignoreCase", exception)) {
					options |= NSRegularExpressionCaseInsensitive;
				}
				NSRegularExpression *re = [NSRegularExpression regularExpressionWithPattern:TiValueRefToId(ctx, sourceValue, exception) options:options error:&error];
				TiStringRelease(source);
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
				void *p = TiObjectGetPrivate(obj);
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
				TiStringRef prop = TiStringCreateWithUTF8CString("$native");
				if (TiObjectHasProperty(ctx, obj, prop)) {
					TiValueRef nativeRef = TiObjectGetProperty(ctx, obj, prop, exception);
					CHECKEXCEPTION_NSNULL
					id nativeObj = TiValueRefToId(ctx, nativeRef, exception);
					CHECKEXCEPTION_NSNULL
					TiStringRelease(prop);
					return nativeObj;
				}
				TiStringRelease(prop);
				NSMutableDictionary *result = [NSMutableDictionary dictionary];
				TiPropertyNameArrayRef props = TiObjectCopyPropertyNames(ctx, obj);
				size_t len = TiPropertyNameArrayGetCount(props);
				for (unsigned c = 0; c < len; c++) {
					TiStringRef name = TiPropertyNameArrayGetNameAtIndex(props, c);
					TiValueRef val = TiObjectGetProperty(ctx, obj, name, exception);
					id value = TiValueRefToId(ctx, val, exception);
					[result setObject:value forKey:NSStringFromTiStringRef(ctx, name, exception)];
				}
				// if it looks like an exception, add the message to the output
				// FIXME: test for constructor instead
				if ([result objectForKey:@"line"] && [result objectForKey:@"column"]) {
					TiStringRef prop = TiStringCreateWithUTF8CString("message");
					TiValueRef val = TiObjectGetProperty(ctx, obj, prop, exception);
					id value = TiValueRefToId(ctx, val, exception);
					[result setObject:value forKey:NSStringFromTiStringRef(ctx, prop, exception)];
					TiStringRelease(prop);

					prop = TiStringCreateWithUTF8CString("stack");
					val = TiObjectGetProperty(ctx, obj, prop, exception);
					value = TiValueRefToId(ctx, val, exception);
					[result setObject:value forKey:NSStringFromTiStringRef(ctx, prop, exception)];
					TiStringRelease(prop);
				}
				TiPropertyNameArrayRelease(props);
				return result;
			}
		}
	}

	return [NSNull null];
}

/**
 * called when a new JS instance is created to retain the native object
 */
static void Initializer (TiContextRef ctx, TiObjectRef object) {
	id obj = (__bridge id)TiObjectGetPrivate(object);
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
static void Finalizer (TiObjectRef object) {
	id obj = (__bridge id)TiObjectGetPrivate(object);
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
static TiObjectRef Constructor (TiContextRef ctx, TiObjectRef constructor, size_t argumentCount, const TiValueRef arguments[], TiValueRef* exception) {
	id obj;
	if (argumentCount) {
		obj = TiValueRefToId(ctx, arguments[0], exception);
	} else {
		HyperloopClass *cls = (__bridge HyperloopClass *)TiObjectGetPrivate(constructor);
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
	return TiValueMakeUndefined(ctx);
JS_CALLBACK_END
#endif

JS_CALLBACK(GetWrapper)
	TiObjectRef thisObject = TiValueToObject(ctx, arguments[0], exception);
	CHECKEXCEPTION
	id nativePointer = (__bridge id)(TiObjectGetPrivate(thisObject));
	if (nativePointer == nil) {
		return TiValueMakeUndefined(ctx);
	}

	TiValueRef result = HyperloopGetWrapperForId(nativePointer);
	if (result == NULL) {
		return TiValueMakeUndefined(ctx);
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
	TiObjectRef thisObject = TiValueToObject(ctx, arguments[0], exception);
	CHECKEXCEPTION
	id nativePointer = nil;
	{
		TiStringRef str;
		TiObjectRef jsObject;
		{
			str = TiStringCreateWithUTF8CString("$native");
			TiValueRef value = TiObjectGetProperty(ctx, thisObject, str, exception);
			TiStringRelease(str);
			CHECKEXCEPTION
			jsObject = TiValueToObject(ctx, value, exception);
			CHECKEXCEPTION;
		}

		nativePointer = (__bridge id)(TiObjectGetPrivate(jsObject));
		{
			str = TiStringCreateWithUTF8CString("__wrapper__");
			if ([nativePointer isKindOfClass:[KrollObject class]]) {
				jsObject = [(KrollObject*)nativePointer propsObject];
			}
			TiObjectSetProperty(ctx, jsObject, str, thisObject, kTiPropertyAttributeDontDelete, exception);
			TiStringRelease(str);
			CHECKEXCEPTION;
		}

		// if ([nativePointer isKindOfClass:[HyperloopClass class]] || [nativePointer isKindOfClass:[KrollObject class]]) {
		// 	NSLog(@"[HYPERLOOP] RegisterWrapper %@ %p", [[nativePointer target] class], [nativePointer target]);
		// }
	}
	HyperloopRegisterWrapper(nativePointer, thisObject);
	return TiValueMakeUndefined(ctx);
JS_CALLBACK_END

/**
 * create a new Class proxy
 */
JS_CALLBACK(NewProxy)
	NSDictionary *properties = TiValueRefToId(ctx, arguments[0], exception);
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
	NSString *encoding = TiValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	HyperloopPointer *pointer = [HyperloopPointer encoding:[encoding UTF8String]];
	if (argumentCount == 3) {
		NSString *framework = TiValueRefToId(ctx, arguments[1], exception);
		CHECKEXCEPTION
		NSString *classname = TiValueRefToId(ctx, arguments[2], exception);
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
	NSString *selector = NSStringFromTiValueRef(ctx, arguments[1], exception);
	CHECKEXCEPTION
	id args = argumentCount > 2 ? TiValueRefToId(ctx, arguments[2], exception) : nil;
	CHECKEXCEPTION

	id target = TiValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION

	if ([args isEqual:[NSNull null]]) {
		args = nil;
	}
	// dispatch can take just one argument, in which case, we need to turn it into an array of 1
	if (args && [args isKindOfClass:[NSArray class]] == NO) {
		args = @[args];
	}
	BOOL isInstance = argumentCount > 3 ? TiValueToBoolean(ctx, arguments[3]) : YES;
	id result = [HyperloopUtils invokeSelector:NSSelectorFromString(selector) args:args target:target instance:isInstance];
	if (result == nil || [result isEqual:[NSNull null]]) {
		return TiValueMakeNull(ctx);
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
		return TiValueMakeNumber(ctx, [result doubleValue]);
	}
	return TiValueMakeUndefined(ctx);
JS_CALLBACK_END

/**
 * define a custom class
 */
JS_CALLBACK(DefineClass)
	if (argumentCount < 1) {
		@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"you must pass at least 1 arguments to DefineClass" userInfo:nil];
	}
	// no-op since the bulk of the work is done at compile time
	NSString *name = TiValueRefToId(ctx, arguments[0], exception);
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
	id targetClass = TiValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	NSDictionary *props = TiValueRefToId(ctx, arguments[1], exception);
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

	return TiValueMakeNull(ctx);
JS_CALLBACK_END

/**
 * return true if object is of type [NSNull class]
 */
JS_CALLBACK(IsNull)
	id target = TiValueRefToId(ctx, arguments[0], exception);
	CHECKEXCEPTION
	if (!target || [target isEqual:[NSNull null]]) {
		return TiValueMakeBoolean(ctx, YES);
	}
	return TiValueMakeBoolean(ctx, NO);
JS_CALLBACK_END

/**
 * protect the passed in JS value from garbage collection
 */
JS_CALLBACK(Protect)
	TiValueProtect(ctx, arguments[0]);
	return TiValueMakeBoolean(ctx, YES);
JS_CALLBACK_END

/**
 * unprotect the passed in JS value so that it can be garbage collected
 */
JS_CALLBACK(Unprotect)
	TiValueUnprotect(ctx, arguments[0]);
	return TiValueMakeBoolean(ctx, YES);
JS_CALLBACK_END

/**
 * logger utility which will correctly handle serialization of JS / native objects
 */
JS_CALLBACK(Logger)
	NSMutableArray *array = [NSMutableArray arrayWithCapacity:argumentCount];
	for (size_t c = 0; c < argumentCount; c++) {
		TiStringRef s = TiValueToStringCopy(ctx, arguments[c], exception);
		CHECKEXCEPTION
		NSString *str = NSStringFromTiStringRef(ctx, s, exception);
		CHECKEXCEPTION
		[array addObject:str];
	}
	NSLog(@"[INFO] %@", [array componentsJoinedByString:@" "]);
	return TiValueMakeNull(ctx);
JS_CALLBACK_END

/**
 * coerce is JS value from one type to another
 */
static TiValueRef Convert (TiContextRef ctx, TiObjectRef object, TiType type, TiValueRef* exception) {
	id ref = (__bridge id)(TiObjectGetPrivate(object));
	switch (type) {
		case kTITypeUndefined: {
			return TiValueMakeUndefined(ctx);
		}
		case kTITypeNull: {
			return TiValueMakeNull(ctx);
		}
		case kTITypeBoolean: {
			if ([ref respondsToSelector:@selector(boolValue)]) {
				return TiValueMakeBoolean(ctx, [ref boolValue]);
			}
			return TiValueMakeBoolean(ctx, false);
		}
		case kTITypeNumber: {
			if ([ref respondsToSelector:@selector(doubleValue)]) {
				return TiValueMakeNumber(ctx, [ref doubleValue]);
			}
			return TiValueMakeNumber(ctx, NAN);
		}
		case kTITypeString: {
			TiStringRef str = TiStringCreateWithUTF8CString([[ref description] UTF8String]);
			TiValueRef result = TiValueMakeString(ctx, str);
			TiStringRelease(str);
			return result;
		}
		case kTITypeObject: {
			return object;
		}
	}
}

/**
 * stringify a JS object
 */
static TiValueRef String (TiContextRef ctx, TiObjectRef function, TiObjectRef thisObject, size_t argumentCount, const TiValueRef arguments[], TiValueRef *exception) {
	@autoreleasepool {
		if (TiValueIsObject(ctx, arguments[0])) {
			TiObjectRef obj = TiValueToObject(ctx, arguments[0], exception);
			CHECKEXCEPTION
			id target = (__bridge id)(TiObjectGetPrivate(obj));
			if (target) {
				TiStringRef str = TiStringCreateWithUTF8CString([[target description] UTF8String]);
				TiValueRef result = TiValueMakeString(ctx, str);
				TiStringRelease(str);
				return result;
			}
			return Convert(ctx, obj, kTITypeString, exception);
		} else if (TiValueIsString(ctx, arguments[0])) {
			return arguments[0];
		} else if (TiValueIsBoolean(ctx, arguments[0])) {
			if (TiValueToBoolean(ctx, arguments[0])) {
				TiStringRef str = TiStringCreateWithUTF8CString("true");
				TiValueRef result = TiValueMakeString(ctx, str);
				TiStringRelease(str);
				return result;
			} else {
				TiStringRef str = TiStringCreateWithUTF8CString("false");
				TiValueRef result = TiValueMakeString(ctx, str);
				TiStringRelease(str);
				return result;
			}
		} else if (TiValueIsNumber(ctx, arguments[0])) {
			double n = TiValueToNumber(ctx, arguments[0], exception);
			CHECKEXCEPTION
			NSNumber *num = [NSNumber numberWithDouble:n];
			TiStringRef str = TiStringCreateWithUTF8CString([[num stringValue] UTF8String]);
			TiValueRef result = TiValueMakeString(ctx, str);
			TiStringRelease(str);
			return result;
		} else {
			return TiValueMakeNull(ctx);
		}
	}
}

#define GETNUMVALUE(type, name, fn, def) \
JS_CALLBACK(name)\
	if (TiValueIsObject(ctx, arguments[0])) {\
		TiObjectRef obj = TiValueToObject(ctx, arguments[0], exception);\
		CHECKEXCEPTION\
		id target = (__bridge id)TiObjectGetPrivate(obj);\
		NSNumber *result = [NSNumber numberWith##name:[HyperloopPointer type##Value:target]];\
		return fn(ctx, [result type##Value]); \
	} else if (TiValueIsBoolean(ctx, arguments[0])) {\
		return fn(ctx, TiValueToBoolean(ctx, arguments[0]));\
	} else if (TiValueIsNumber(ctx, arguments[0])) { \
		return fn(ctx, TiValueToNumber(ctx, arguments[0], exception));\
	}\
	return TiValueMakeBoolean(ctx, def);\
JS_CALLBACK_END

GETNUMVALUE(bool, Bool, TiValueMakeBoolean, false);
GETNUMVALUE(float, Float, TiValueMakeNumber, NAN);
GETNUMVALUE(int, Int, TiValueMakeNumber, NAN);
GETNUMVALUE(short, Short, TiValueMakeNumber, NAN);
GETNUMVALUE(double, Double, TiValueMakeNumber, NAN);
GETNUMVALUE(long, Long, TiValueMakeNumber, NAN);
GETNUMVALUE(longLong, LongLong, TiValueMakeNumber, NAN);
GETNUMVALUE(char, Char, TiValueMakeNumber, NAN);
GETNUMVALUE(unsignedInt, UnsignedInt, TiValueMakeNumber, NAN);
GETNUMVALUE(unsignedLong, UnsignedLong, TiValueMakeNumber, NAN);
GETNUMVALUE(unsignedLongLong, UnsignedLongLong, TiValueMakeNumber, NAN);
GETNUMVALUE(unsignedShort, UnsignedShort, TiValueMakeNumber, NAN);
GETNUMVALUE(unsignedChar, UnsignedChar, TiValueMakeNumber, NAN);

// directly from titanium_prep
static const char ALPHA [] = {'0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'};
extern NSString * const TI_APPLICATION_GUID;
extern NSString * const TI_APPLICATION_DEPLOYTYPE;

/**
 * returns true if platform GUID, false if not (open source, legacy, invalid, etc)
 *
 * the platform guid is a special guid where it is a valid UUID v4 string but specifically
 * encoded in a certain way so that we can determine predicitably if it's a platform generated
 * GUID or one that wasn't generated with the platform.
 *
 * The GUID format is a generated random UUID v4 but where the following is changed:
 *
 * 9cba353d-81aa-4593-9111-2e83c0136c14
 *					  ^
 *					  +---- always 9
 *
 * 9cba353d-81aa-4593-9111-2e83c0136c14
 *					   ^^^
 *					   +---- the following 3 characters will be the same and will be
 *							 one of 0-9a-f
 *
 * 9cba353d-81aa-4593-9111-2e83c0136c14
 *						   ^
 *						   +----- the last remaining string is a SHA1 encoding of
 *								  the org_id + app id (first 12 characters of the SHA1)
 *
 */
static BOOL isPlatformGUID (NSString *guid) {
	// UUID v4 is 36 characters long
	if ([guid length] == 36) {
		// example guid: 9cba353d-81aa-4593-9111-2e83c0136c14
		// for org_id 14301, appid : com.tii
		if ([guid characterAtIndex:19] == '9') {
			char alpha = [guid characterAtIndex:20];
			BOOL found = NO;
			for (size_t c=0;c<sizeof(ALPHA);c++) {
				if (alpha == ALPHA[c]) {
					found = YES;
					break;
				}
			}
			if (found) {
				NSString *str = [guid substringWithRange:NSMakeRange(20, 3)];
				if ([str isEqualToString:[NSString stringWithFormat:@"%c%c%c",alpha,alpha,alpha]]) {
					return YES;
				}
			}
		}
	}
	return NO;
}

@implementation Hyperloop

/**
 * this method is called before Titanium loads to allow Hyperloop to bootstrap into the JS VM
 */
+(void)willStartNewContext:(KrollContext *)kroll bridge:(KrollBridge *)krollbridge {
#if TARGET_OS_SIMULATOR
	NSLog(@"[HYPERLOOP] willStartNewContext %@", kroll);
#endif

	// if not a valid platform GUID, we aren't going to enable Hyperloop
	if (isPlatformGUID(TI_APPLICATION_GUID) == NO) {
		NSLog(@"[ERROR] Hyperloop is not currently supported because this application has not been registered. To register this application with the Appcelerator Platform, run the command: appc new --import");
#if TARGET_OS_SIMULATOR
		UIAlertView *theAlert = [[UIAlertView alloc] initWithTitle:@"Hyperloop"
                                                           message:@"Hyperloop is not currently supported because this application has not been registered. To register this application with the Appcelerator Platform, run the command: appc new --import"
                                                          delegate:nil
                                                 cancelButtonTitle:@"OK"
                                                 otherButtonTitles:nil];
		[theAlert show];
#endif
		return;
	}

	context = kroll;
	bridge = krollbridge;
	TiGlobalContextRef ctx = (TiGlobalContextRef)[kroll context];
	TiGlobalContextRetain(ctx);

	// create our hyperloop class
	TiClassDefinition classDef = kTiClassDefinitionEmpty;
	classDef.className = "Hyperloop";
	classDef.initialize = Initializer;
	classDef.finalize = Finalizer;
	classDef.convertToType = Convert;
	objectClassRef = TiClassCreate(&classDef);


	classDef.className = "HyperloopPointer";
	pointerClassRef = TiClassCreate(&classDef);

	TiObjectRef globalObjectRef = TiContextGetGlobalObject(ctx);
	TiValueRef exception = NULL;

	// create our base constructor
	classDef.className = "HyperloopObject";
	classDef.callAsConstructor = Constructor;
	constructorClassRef = TiClassCreate(&classDef);

	TiStaticFunction StaticFunctionsArray [] = {
		{ "addMethod", AddMethod,
			kTiPropertyAttributeReadOnly | kTiPropertyAttributeDontEnum | kTiPropertyAttributeDontDelete },
		NULL
	};

	classDef.staticFunctions = StaticFunctionsArray;
	classDef.className = "HyperloopClass";
	classClassRef = TiClassCreate(&classDef);

	TiStringRef constructorProp = TiStringCreateWithUTF8CString("HyperloopObject");
	TiObjectRef constructor = HLObjectMake(ctx, constructorClassRef, 0);
	TiObjectSetProperty(ctx, globalObjectRef, constructorProp, constructor, kTiPropertyAttributeDontDelete, &exception);
	assert(exception==NULL);

	// register it with the Global Context
	TiStringRef href = TiStringCreateWithUTF8CString("Hyperloop");
	TiObjectRef objectRef = HLObjectMake(ctx, objectClassRef, context);
	assert(exception==NULL);

	#define MAKECALLBACK(name, fn) \
	{\
		TiStringRef ref##name = TiStringCreateWithUTF8CString(STR(name));\
		TiObjectRef newProxy##name = TiObjectMakeFunctionWithCallback(ctx, ref##name, fn);\
		TiObjectSetProperty(ctx, objectRef, ref##name, newProxy##name, kTiPropertyAttributeReadOnly | kTiPropertyAttributeDontEnum | kTiPropertyAttributeDontDelete, &exception);\
		TiStringRelease(ref##name);\
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
		TiStringRef ref##name = TiStringCreateWithUTF8CString(STR(type##Value));\
		TiObjectRef fn##name = TiObjectMakeFunctionWithCallback(ctx, ref##name, name);\
		TiObjectSetProperty(ctx, objectRef, ref##name, fn##name, kTiPropertyAttributeReadOnly | kTiPropertyAttributeDontEnum | kTiPropertyAttributeDontDelete, &exception);\
		TiStringRelease(ref##name);\
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
	TiObjectSetProperty(ctx, globalObjectRef, href, objectRef, kTiPropertyAttributeReadOnly | kTiPropertyAttributeDontEnum | kTiPropertyAttributeDontDelete, &exception);
	TiValueProtect(ctx, objectRef);
	TiStringRelease(href);
	assert(exception==NULL);
}

/**
 * this method is called after Titanium starts the context
 */
+(void)didStartNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge{
#if TARGET_OS_SIMULATOR
	NSLog(@"[HYPERLOOP] didStartNewContext %@", kroll);
#endif
}


/**
 * this method is called before Titanium shuts down the context
 */
+(void)willStopNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge{
#if TARGET_OS_SIMULATOR
	NSLog(@"[HYPERLOOP] willStopNewContext %@", kroll);
#endif
	if (context) {
		[callbacks removeAllObjects];
		[modules removeAllObjects];
		TiGlobalContextRef ctx = (TiGlobalContextRef)[kroll context];
		TiStringRef prop = TiStringCreateWithUTF8CString("Hyperloop");
		TiObjectRef globalObjectRef = TiContextGetGlobalObject(ctx);
		TiValueRef objectRef = TiObjectGetProperty(ctx, globalObjectRef, prop, NULL);
		TiValueUnprotect(ctx, objectRef);
		TiObjectDeleteProperty(ctx, globalObjectRef, prop, NULL);
		TiStringRelease(prop);
		TiClassRelease(classClassRef);
		TiClassRelease(pointerClassRef);
		TiClassRelease(constructorClassRef);
		TiClassRelease(objectClassRef);
		TiGlobalContextRelease(ctx);
		ARCRelease(callbacks);
		ARCRelease(modules);
		classClassRef = nil;
		pointerClassRef = nil;
		constructorClassRef = nil;
		context = nil;
		callbacks = nil;
		modules = nil;
	}
}

/**
 * this method is called after Titanium stops the context
 */
+(void)didStopNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge{
#if TARGET_OS_SIMULATOR
	NSLog(@"[HYPERLOOP] didStopNewContext %@", kroll);
#endif
}

+(TiObjectRef)createPointer:(HyperloopPointer *)pointer {
	return HLObjectMake(context.context, pointerClassRef, pointer);
}

+(NSException *)JSValueRefToNSException:(TiValueRef)exception {
	NSDictionary *dictionary = TiValueRefToId(context.context, exception, 0);
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
