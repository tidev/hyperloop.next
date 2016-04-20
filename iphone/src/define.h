/**
 * Hyperloop Library
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#define STR(a) #a

#import <JavaScriptCore/JavaScriptCore.h>

#ifdef TIMODULE
	#import "TiBase.h"
    #import "KrollCallback.h"
#endif

#define BASECLASS NSObject<HyperloopBase>

extern BOOL isIOS9OrGreater();
extern BOOL HLValueIsArray(JSContextRef js_context_ref, JSValueRef js_value_ref);
extern BOOL HLValueIsDate(JSContextRef js_context_ref, JSValueRef js_value_ref);

#define JSObjectMakeConstructor JSObjectMakeConstructor


#define RELEASE_AND_CHECK(s) { if (s) { s = nil; } }

#if defined(DEBUG)
#if TARGET_OS_SIMULATOR
#define REMEMBER(p) { HyperloopTrackAddObject((__bridge void *)(p), [NSString stringWithFormat:@"%p (%@) (%s:%d)\n%@", p, [p class], __FILE__, __LINE__, [[NSThread callStackSymbols] componentsJoinedByString:@"\n"]]); }
#define FORGET(p) HyperloopTrackRemoveObject((__bridge void *)(p))
extern void HyperloopTrackAddObject (void * p, id description);
extern void HyperloopTrackRemoveObject (void * p);
extern void HyperloopTrackDumpAll();
#define HYPERLOOP_MEMORY_TRACKING
#else
#endif
#endif

#ifndef REMEMBER
#define REMEMBER(p) {}
#define FORGET(p) {}
#endif

#define ARCRetain(...) { void *retainedThing = (__bridge_retained void *)__VA_ARGS__; retainedThing = retainedThing; }

#define ARCRelease(...) { void *retainedThing = (__bridge void *) __VA_ARGS__; id unretainedThing = (__bridge_transfer id)retainedThing; unretainedThing = nil; }

@protocol HyperloopBase

@required
@property(nonatomic, retain) id nativeObject;

@end
