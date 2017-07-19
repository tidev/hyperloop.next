/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

#import "define.h"

@import UIKit;


/**
 * Remove the extranous struct from the C encoding such as the CGRect struct:
 *
 * @param str The string, formatted like: (nonatomic, {CGPoint=dd}{CGSize=dd})
 * @return Should return "dddd"
 */
static NSString *stringWithoutGarbage(NSString *str)
{
    NSRange r1 = [str rangeOfString:@"{"];
    NSRange r2 = [str rangeOfString:@"="];
    if (r1.location == NSNotFound || r2.location == NSNotFound) {
        // could be just {dd}
        str = [str stringByReplacingOccurrencesOfString:@"}" withString:@""];
        str = [str stringByReplacingOccurrencesOfString:@"{" withString:@""];
        return str;
    }
    
    NSRange range = NSMakeRange(r1.location, r2.location - r1.location + 1);
    NSString *result = [str stringByReplacingCharactersInRange:range withString:@""];
    result = [result stringByReplacingOccurrencesOfString:@"}" withString:@""];
    return stringWithoutGarbage(result);
}

NSString *cleanupEncoding(NSString *encoding)
{
    const char ch = [encoding characterAtIndex:0];
    if (ch == 'r' || ch == 'n' || ch == 'N' || ch == 'o' || ch == 'O' || ch == 'R' || ch == 'V') {
        return [encoding substringFromIndex:1];
    }
    return encoding;
}

#ifdef USE_JSCORE_FRAMEWORK
BOOL isIOS9OrGreater()
{
    return [[[UIDevice currentDevice] systemVersion] compare:@"9.0" options:NSNumericSearch] != NSOrderedAscending;
}

BOOL HLValueIsArray(JSContextRef js_context_ref, JSValueRef js_value_ref)
{
	if (!TiValueIsObject(js_context_ref, js_value_ref))
		return NO;
	if (isIOS9OrGreater())
		return JSValueIsArray(js_context_ref, js_value_ref);
	JSStringRef property_name = JSStringCreateWithUTF8CString("Array");
	JSObjectRef js_object_ref = (JSObjectRef)JSObjectGetProperty(js_context_ref, JSContextGetGlobalObject(js_context_ref), property_name, NULL);
	JSStringRelease(property_name);
	BOOL isArray = JSValueIsInstanceOfConstructor(js_context_ref, js_value_ref, js_object_ref, NULL);
	return isArray;
}

BOOL HLValueIsDate(JSContextRef js_context_ref, JSValueRef js_value_ref)
{
	if (!TiValueIsObject(js_context_ref, js_value_ref))
		return NO;
	if (isIOS9OrGreater())
		return JSValueIsDate(js_context_ref, js_value_ref);
	JSStringRef property_name = JSStringCreateWithUTF8CString("Date");
	JSObjectRef js_object_ref = (JSObjectRef)JSObjectGetProperty(js_context_ref, JSContextGetGlobalObject(js_context_ref), property_name, NULL);
	JSStringRelease(property_name);
	BOOL isDate = JSValueIsInstanceOfConstructor(js_context_ref, js_value_ref, js_object_ref, NULL);
	return isDate;
}
#endif

#ifdef HYPERLOOP_MEMORY_TRACKING
static NSMutableDictionary *hashTable;

void HyperloopTrackAddObject(void *p, id desc)
{
	if (!hashTable) {
		hashTable = [NSMutableDictionary dictionary];
	}
	NSNumber *key = [NSNumber numberWithLong:(long)p];
	[hashTable setObject:desc forKey:key];
}

void HyperloopTrackRemoveObject(void *p)
{
	NSNumber *key = [NSNumber numberWithLong:(long)p];
	[hashTable removeObjectForKey:key];
}

void HyperloopTrackDumpAll()
{
	if ([hashTable count] != 0) {
		NSArray<NSString *> *values = [hashTable allValues];
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

#endif
