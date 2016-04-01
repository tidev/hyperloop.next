/**
 * Hyperloop Library
 * Copyright (c) 2016 by Appcelerator, Inc.
 */

#include "define.h"

BOOL isIOS9OrGreater() {
	return [NSClassFromString(@"UIImage") instancesRespondToSelector:@selector(flipsForRightToLeftLayoutDirection)];;
}

BOOL HLValueIsArray(JSContextRef js_context_ref, JSValueRef js_value_ref) {
	if (!JSValueIsObject(js_context_ref, js_value_ref)) return NO;
	if (isIOS9OrGreater()) return JSValueIsArray(js_context_ref, js_value_ref);
	JSStringRef property_name = JSStringCreateWithUTF8CString("Array");
	JSObjectRef js_object_ref = (JSObjectRef)JSObjectGetProperty(js_context_ref, JSContextGetGlobalObject(js_context_ref), property_name, NULL);
	JSStringRelease(property_name);
	BOOL isArray = JSValueIsInstanceOfConstructor(js_context_ref, js_value_ref, js_object_ref, NULL);
	return isArray;
}
BOOL HLValueIsDate(JSContextRef js_context_ref, JSValueRef js_value_ref) {
	if (!JSValueIsObject(js_context_ref, js_value_ref)) return NO;
	if (isIOS9OrGreater()) return JSValueIsDate(js_context_ref, js_value_ref);
	JSStringRef property_name = JSStringCreateWithUTF8CString("Date");
	JSObjectRef js_object_ref = (JSObjectRef)JSObjectGetProperty(js_context_ref, JSContextGetGlobalObject(js_context_ref), property_name, NULL);
	JSStringRelease(property_name);
	BOOL isDate = JSValueIsInstanceOfConstructor(js_context_ref, js_value_ref, js_object_ref, NULL);
	return isDate;
}
#endif

#ifdef HYPERLOOP_MEMORY_TRACKING
static NSMutableDictionary *hashTable;

void HyperloopTrackAddObject (void * p, id desc) {
	if (!hashTable) {
		hashTable = [NSMutableDictionary dictionary];
	}
	NSNumber *key = [NSNumber numberWithLong:(long)p];
	[hashTable setObject:desc forKey:key];
}

void HyperloopTrackRemoveObject (void * p) {
	NSNumber *key = [NSNumber numberWithLong:(long)p];
	[hashTable removeObjectForKey:key];
}

void HyperloopTrackDumpAll() {
	if ([hashTable count] != 0) {
		NSArray <NSString *> *values = [hashTable allValues];
		NSLog(@"[ERROR] found the following leaked objects:");
		NSLog(@" ");
		for (NSString *each in values) {
			NSLog(@"%@", [each stringByReplacingOccurrencesOfString:@"\\n" withString:@"\n"]);
			NSLog(@" ");
		}
		//		assert(false);
	}
	hashTable = nil;
}
