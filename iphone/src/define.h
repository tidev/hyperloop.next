/**
 * Hyperloop Library
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#define STR(a) #a

#ifdef TIMODULE
	#import "TiBase.h"
    #import "KrollCallback.h"
#endif

#define BASECLASS NSObject<HyperloopBase>

#import "TiToJS.h"

#ifdef USE_JSCORE_FRAMEWORK

BOOL isIOS9OrGreater()
{
	return [NSClassFromString(@"UIImage") instancesRespondToSelector:@selector(flipsForRightToLeftLayoutDirection)];;
}

BOOL HLValueIsArray(JSContextRef js_context_ref, JSValueRef js_value_ref) {
	if (!TiValueIsObject(js_context_ref, js_value_ref)) return NO;
	if (isIOS9OrGreater()) return JSValueIsArray(js_context_ref, js_value_ref);
	JSStringRef property_name = JSStringCreateWithUTF8CString("Array");
	JSObjectRef js_object_ref = (JSObjectRef)JSObjectGetProperty(js_context_ref, JSContextGetGlobalObject(js_context_ref), property_name, NULL);
	JSStringRelease(property_name);
	BOOL isArray = JSValueIsInstanceOfConstructor(js_context_ref, js_value_ref, js_object_ref, NULL);
	return isArray;
}
BOOL HLValueIsDate(JSContextRef js_context_ref, JSValueRef js_value_ref) {
	if (!TiValueIsObject(js_context_ref, js_value_ref)) return NO;
	if (isIOS9OrGreater()) return JSValueIsDate(js_context_ref, js_value_ref);
	JSStringRef property_name = JSStringCreateWithUTF8CString("Date");
	JSObjectRef js_object_ref = (JSObjectRef)JSObjectGetProperty(js_context_ref, JSContextGetGlobalObject(js_context_ref), property_name, NULL);
	JSStringRelease(property_name);
	BOOL isDate = JSValueIsInstanceOfConstructor(js_context_ref, js_value_ref, js_object_ref, NULL);
	return isDate;
}
#else
#define HLValueIsDate TiValueIsDate
#define HLValueIsArray TiValueIsArray
#endif

#define TiObjectMakeConstructor JSObjectMakeConstructor

#ifdef TIMODULE
	#ifdef USE_JSCORE_FRAMEWORK
	#define TiObjectCallAsConstructor JSObjectCallAsConstructor
	#else
	TiObjectRef TiObjectCallAsConstructor(TiContextRef ctx, TiObjectRef object, size_t argumentCount, const TiValueRef arguments[], TiValueRef* exception);
	#endif
#else
	#define TiObjectCallAsConstructor JSObjectCallAsConstructor
#endif

#define RELEASE_AND_CHECK(s) { if (s) { s = nil; } }

#if defined(DEBUG) && defined(TARGET_IPHONE_SIMULATOR)
#define REMEMBER(p) { HyperloopTrackAddObject((__bridge void *)(p), [NSString stringWithFormat:@"%p (%@) (%s:%d)\n%@", p, [p class], __FILE__, __LINE__, [[NSThread callStackSymbols] componentsJoinedByString:@"\n"]]); }
#define FORGET(p) HyperloopTrackRemoveObject((__bridge void *)(p))
void HyperloopTrackAddObject (void * p, id description);
void HyperloopTrackRemoveObject (void * p);
void HyperloopTrackDumpAll();
#define HYPERLOOP_MEMORY_TRACKING
#else
#define REMEMBER(p)
#define FORGET(p)
#endif


#define ARCRetain(...) { void *retainedThing = (__bridge_retained void *)__VA_ARGS__; retainedThing = retainedThing; }

#define ARCRelease(...) { void *retainedThing = (__bridge void *) __VA_ARGS__; id unretainedThing = (__bridge_transfer id)retainedThing; unretainedThing = nil; }

@protocol HyperloopBase

@required
@property(nonatomic, retain) id nativeObject;

@end
