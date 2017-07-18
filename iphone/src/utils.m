/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#import "utils.h"
#import "pointer.h"
#import "class.h"
#ifdef TIMODULE
#import "HyperloopModule.h"
#endif

#define DEBUG_INVOKE 0

#ifndef TIMODULE
@interface KrollContext : NSObject
- (TiContextRef)context;
@end

@interface KrollCallback : NSObject
- (TiObjectRef)function;
@end
#endif

TiObjectRef HyperloopGetWrapperForId(id obj);
TiValueRef NSObjectToJSObject(id object);
TiContextRef HyperloopCurrentContext();
NSString *cleanEncoding(NSString *encoding);
KrollCallback *HyperloopGetCallbackForIdentifier(NSString *identifier);
id TiValueRefToId(TiContextRef ctx, const TiValueRef value, TiValueRef *exception);

@implementation HyperloopUtils

/**
 * given an argument for an NSInvocation, attempt to unmarshal any special
 * argument types and set them in the invocation at index
 */
+ (id)unmarshalObject:(NSInvocation *)invocation arg:(id)arg index:(NSUInteger)index
{
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
	NSLog(@"[DEBUG] unmarshalObject %@ -> %@ at %zu", invocation, [arg class], index);
#endif
	if (arg == nil || [arg isEqual:[NSNull null]]) {
		if (invocation) {
			arg = nil;
			[invocation setArgument:&arg atIndex:index];
		} else {
			return [NSNull null];
		}
	} else if ([arg isKindOfClass:[NSArray class]]) {
		if ([arg count] > 0) {
			NSMutableArray *copy = [NSMutableArray arrayWithArray:arg];
			for (NSUInteger index = 0; index < [copy count]; index++) {
				id obj = [copy objectAtIndex:index];
				[copy setObject:[HyperloopUtils unmarshalObject:nil arg:obj index:0] atIndexedSubscript:index];
			}
			if (invocation) {
				[invocation setArgument:&copy atIndex:index];
			} else {
				return copy;
			}
		}
	} else if ([arg isKindOfClass:[NSDictionary class]]) {
		// see if we have a native property and if so, pull it out and treat it like a pointer
		id p = [arg objectForKey:@"$native"];
		if (p && [p isKindOfClass:[HyperloopPointer class]]) {
			if (invocation) {
				[p setArgument:invocation atIndex:index];
				return nil;
			} else {
				return p;
			}
		}
		NSMutableDictionary *copy = [NSMutableDictionary dictionaryWithDictionary:arg];
		for (id key in [copy allKeys]) {
			id obj = [copy objectForKey:key];
			id newobj = [HyperloopUtils unmarshalObject:nil arg:obj index:0];
			if ([obj isEqual:newobj] == NO) {
				[copy setObject:newobj forKey:key];
			}
		}
		if (invocation) {
			[invocation setArgument:&copy atIndex:index];
		} else {
			return copy;
		}
	} else if ([arg isKindOfClass:[HyperloopPointer class]]) {
		HyperloopPointer *p = (HyperloopPointer *)arg;
		if (invocation) {
			[p setArgument:invocation atIndex:index];
		} else {
			return p;
		}
	} else if ([arg isKindOfClass:[HyperloopClass class]]) {
		HyperloopClass *cls = (HyperloopClass *)arg;
		id nativeObj = [cls target];
		if (invocation) {
			[invocation setArgument:&nativeObj atIndex:index];
		} else {
			return nativeObj;
		}
	} else if ([arg isKindOfClass:[NSObject class]]) {
		if (!invocation) {
			return arg;
		}
		NSMethodSignature *sig = [invocation methodSignature];
		const char *type = [cleanEncoding([NSString stringWithUTF8String:[sig getArgumentTypeAtIndex:index]]) UTF8String];

		if (type[0] != '@') {
#define SETVALUE(c, typev, sel)                                                                                                                                                                      \
	case c: {                                                                                                                                                                                        \
		typev value;                                                                                                                                                                                 \
		if ([arg isEqual:[NSNull null]]) {                                                                                                                                                           \
			if (invocation) {                                                                                                                                                                        \
				[invocation setArgument:&arg atIndex:index];                                                                                                                                         \
			} else {                                                                                                                                                                                 \
				return arg;                                                                                                                                                                          \
			}                                                                                                                                                                                        \
		} else if ([arg respondsToSelector:@selector(sel)]) {                                                                                                                                        \
			value = [arg sel];                                                                                                                                                                       \
			if (invocation) {                                                                                                                                                                        \
				[invocation setArgument:&value atIndex:index];                                                                                                                                       \
			} else {                                                                                                                                                                                 \
				return arg;                                                                                                                                                                          \
			}                                                                                                                                                                                        \
		} else {                                                                                                                                                                                     \
			@throw [NSException exceptionWithName:@"InvalidArgumentType" reason:[NSString stringWithFormat:@"cannot convert argument type for [%@ %s] (%s)", [arg class], #sel, type] userInfo:nil]; \
		}                                                                                                                                                                                            \
		break;                                                                                                                                                                                       \
	}

			switch (type[0]) {
				SETVALUE('i', int, intValue);
				SETVALUE('f', float, floatValue);
				SETVALUE('d', double, doubleValue);
				SETVALUE('c', char, charValue);
				SETVALUE('l', long, longValue);
				SETVALUE('s', short, shortValue);
				SETVALUE('q', long long, longLongValue);
				SETVALUE('B', bool, boolValue);
				SETVALUE('Q', unsigned long long, unsignedLongLongValue);
				SETVALUE('S', unsigned short, unsignedShortValue);
				SETVALUE('L', unsigned long, unsignedLongValue);
				SETVALUE('C', unsigned char, unsignedCharValue);

				case ':': {
					SEL sel = NSSelectorFromString([HyperloopPointer stringValue:arg]);
					[invocation setArgument:&sel atIndex:index];
					break;
				}
				case '#': {
					Class cls = NSClassFromString([HyperloopPointer stringValue:arg]);
					[invocation setArgument:&cls atIndex:index];
					break;
				}
				case '*': {
					const char *str = [[HyperloopPointer stringValue:arg] UTF8String];
					[invocation setArgument:&str atIndex:index];
					break;
				}
				case '^': {
					void *p = [arg pointerValue];
					[invocation setArgument:p atIndex:index];
					break;
				}
				default: {
					break;
				}
			}

#undef SETVALUE

		} else {
			if (invocation) {
				[invocation setArgument:&arg atIndex:index];
			}
		}
	} else {
		if (invocation) {
			NSLog(@"[ERROR] Not sure the type of %@ (%@) at %lu", arg, [arg class], (unsigned long)index);
			[invocation setArgument:&arg atIndex:index];
		}
	}
	return arg;
}

#define GETVALUE(enc, type, name)                 \
	case enc: {                                   \
		type value;                               \
		[invocation getReturnValue:&value];       \
		return [NSNumber numberWith##name:value]; \
		break;                                    \
	}

#define GETVALUEOBJ(enc, type)                                                                                    \
	case enc: {                                                                                                   \
		type __autoreleasing value = nil;                                                                         \
		[invocation getReturnValue:&value];                                                                       \
		if (!value)                                                                                               \
			return value;                                                                                         \
		if ([value isKindOfClass:[HyperloopPointer class]]) {                                                     \
			result = (id)value;                                                                                   \
		} else {                                                                                                  \
			result = [HyperloopPointer pointer:(__bridge const void *)value encoding:signature.methodReturnType]; \
		}                                                                                                         \
		break;                                                                                                    \
	}

#define GETVALUEOBJ2(enc, type)                                                        \
	case enc: {                                                                        \
		type value = nil;                                                              \
		[invocation getReturnValue:&value];                                            \
		result = [HyperloopPointer pointer:value encoding:signature.methodReturnType]; \
		break;                                                                         \
	}

/**
 * invoke a selector and return the result
 */
+ (id)invokeSelector:(SEL)aSelector args:(NSArray *)args target:(id)obj instance:(BOOL)instanceMethod
{
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
	NSLog(@"[DEBUG] invokeSelector %@ (%@) -> %@ (%d)", NSStringFromSelector(aSelector), args, [obj class], (int)instanceMethod);
#endif
	BOOL checkClass = YES;
	if ([obj isKindOfClass:[HyperloopClass class]]) {
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
		NSLog(@"[DEBUG] target is HyperloopClass class");
#endif
		obj = [(HyperloopClass *)obj target];
		checkClass = NO;
	}
	if ([obj isKindOfClass:[HyperloopPointer class]]) {
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
		NSLog(@"[DEBUG] target is HyperloopPointer class");
#endif
		HyperloopPointer *p = (HyperloopPointer *)obj;
		if (p.objectValue && [p.objectValue respondsToSelector:aSelector]) {
			obj = p.objectValue;
		} else if (p.classValue && [p.classValue respondsToSelector:aSelector]) {
			obj = p.classValue;
		}
		checkClass = NO;
	}
	if (checkClass && !instanceMethod) {
		obj = [obj class];
	}
	if ([args isEqual:[NSNull null]]) {
		args = nil;
	}
	if ([obj respondsToSelector:aSelector]) {
		NSMethodSignature *signature = [obj methodSignatureForSelector:aSelector];
		NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
		[invocation retainArguments];
		[invocation setSelector:aSelector];
		[invocation setTarget:obj];

		NSUInteger argCount = args ? [args count] : 0;
		NSUInteger numberOfArgs = [signature numberOfArguments];
		if (argCount != (numberOfArgs - 2)) {
			@throw [NSException exceptionWithName:@"WrongArgumentCount" reason:[NSString stringWithFormat:@"Expected %lu arguments for method %@, received %lu", (unsigned long)numberOfArgs - 2, NSStringFromSelector(aSelector), (unsigned long)argCount] userInfo:nil];
		}

		for (NSUInteger i = 2; i < numberOfArgs; i++) {
			id arg = [args objectAtIndex:i - 2];
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
			NSLog(@"[DEBUG] arg %lu %@", i - 2, [arg class]);
#endif
			[HyperloopUtils unmarshalObject:invocation
			                            arg:arg
			                          index:i];
		}
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
		NSLog(@"[DEBUG] calling invoke on %@ -> %@", [obj class], NSStringFromSelector(aSelector));
#endif
		[invocation invoke];
		NSUInteger length = [signature methodReturnLength];
		const char *type = signature.methodReturnType;
		unsigned i = 0;
		char ch = type[i++];
		// these are variable type qualifiers and should be skipped
		if (ch == 'r' || ch == 'n' || ch == 'N' || ch == 'o' || ch == 'O' || ch == 'R' || ch == 'V') {
			ch = type[i++];
		}
		if (length) {
			HyperloopPointer *result = nil;
			switch (ch) {
				GETVALUE('i', int, Int);
				GETVALUE('f', float, Float);
				GETVALUE('d', double, Double);
				GETVALUE('s', short, Short);
				GETVALUE('B', bool, Bool);
				GETVALUE('c', char, Char);
				GETVALUE('l', long, Long);
				GETVALUE('q', long long, LongLong);
				GETVALUE('C', unsigned char, UnsignedChar);
				GETVALUE('I', unsigned int, UnsignedInt);
				GETVALUE('S', unsigned short, UnsignedShort);
				GETVALUE('L', unsigned long, UnsignedLong);
				GETVALUE('Q', unsigned long long, UnsignedLongLong);

				GETVALUEOBJ('@', id);
				GETVALUEOBJ('#', Class);
				GETVALUEOBJ2(':', SEL);
				GETVALUEOBJ2('*', char *);

				case '{': {
					result = [HyperloopPointer encoding:type];
					void *value = [result pointerValue];
					[invocation getReturnValue:value];
					break;
				}
				case '^': {
					// pointer to a struct
					if (type[i] == '{') {
						result = [HyperloopPointer encoding:type];
						void *value = [result pointerValue];
						[invocation getReturnValue:value];
					} else {
						void *value = malloc(length);
						[invocation getReturnValue:&value];
						result = [HyperloopPointer pointer:value encoding:type];
						free(value);
					}
					break;
				}
				default: {
					NSLog(@"[ERROR] don't know how to encode return result of type %s for method %@ on class %@", type, NSStringFromSelector(aSelector), [obj class]);
					break;
				}
			}
#if defined(DEBUG_INVOKE) && DEBUG_INVOKE == 1
			NSLog(@"[DEBUG] returning result %@ (%@) from %@", result, [result class], NSStringFromSelector(aSelector));
#endif
			return result;
		}
		return nil;
	} else {
		NSLog(@"[ERROR] can't find selector %@ for %@", NSStringFromSelector(aSelector), obj);
		[obj doesNotRecognizeSelector:aSelector];
		return nil;
	}
}

#undef GETVALUE
#undef GETVALUEOBJ

/**
 * attempt to return a string value for object val
 */
+ (NSString *)stringify:(id)val
{
	if (val == nil) {
		return nil;
	}
	if ([val isKindOfClass:[NSString class]]) {
		return val;
	}
	if ([val isKindOfClass:[NSURL class]]) {
		if ([val isKindOfClass:[HyperloopPointer class]]) {
			val = [val objectValue];
		}
		if ([val respondsToSelector:@selector(absoluteString)]) {
			return [(NSURL *)val absoluteString];
		}
	}
	if ([val respondsToSelector:@selector(stringValue)]) {
		return [val stringValue];
	}
	return [val description];
}

/**
 * attempt to return a boolean value for object val
 */
+ (BOOL)booleanify:(id)val
{
	if ([val respondsToSelector:@selector(boolValue)]) {
		return [val boolValue];
	}
	return false;
}

/**
 * invoke a callback
 */
+ (void)invokeCallback:(id)callback args:(NSArray *)args thisObject:(id)thisObject
{
	TiContextRef context = HyperloopCurrentContext();
	TiValueRef *jsArgs = NULL;
	if (args) {
		jsArgs = (TiValueRef *)malloc(sizeof(TiValueRef) * [args count]);
		for (size_t c = 0; c < [args count]; c++) {
			jsArgs[c] = NSObjectToJSObject(args[c]);
			TiValueProtect(context, jsArgs[c]);
		}
	}
	TiObjectRef function = [(KrollCallback *)callback function];
	TiValueRef exception = NULL;
	TiValueRef thisRef = NSObjectToJSObject(thisObject);
	TiObjectRef thisObjectRef = TiValueToObject(context, thisRef, &exception);
	TiValueProtect(context, function);
	TiValueProtect(context, thisRef);
	TiObjectCallAsFunction(context, function, thisObjectRef, [args count], jsArgs, &exception);
#if defined(TIMODULE)
#if TARGET_OS_SIMULATOR
	if (exception) {
		NSLog(@"[ERROR] JS exception encountered calling callback: %@", [Hyperloop JSValueRefToNSException:exception]);
	}
#endif
#endif
	if (args) {
		for (size_t c = 0; c < [args count]; c++) {
			TiValueUnprotect(context, jsArgs[c]);
		}
	}
	TiValueUnprotect(context, function);
	TiValueUnprotect(context, thisRef);
	free(jsArgs);
}
/**
 * invoke a custom callback and return a result (if specified)
 */
+ (id)invokeCustomCallback:(NSArray *)args identifier:(NSString *)identifier thisObject:(id)sender
{
	KrollCallback *callback = HyperloopGetCallbackForIdentifier(identifier);
	TiContextRef context = HyperloopCurrentContext();
	TiValueRef *jsArgs = NULL;
	if (args) {
		jsArgs = (TiValueRef *)malloc(sizeof(TiValueRef) * [args count]);
		for (size_t c = 0; c < [args count]; c++) {
			jsArgs[c] = NSObjectToJSObject(args[c]);
			TiValueProtect(context, jsArgs[c]);
		}
	}
	id result = nil;
	TiObjectRef function = [callback function];
	TiValueRef exception = NULL;
	TiValueProtect(context, function);
	TiObjectRef thisObject = HyperloopGetWrapperForId(sender);
	TiValueRef jsResult = TiObjectCallAsFunction(context, function, thisObject, [args count], jsArgs, &exception);
#if defined(TIMODULE)
#if TARGET_OS_SIMULATOR
	if (exception) {
		NSLog(@"[ERROR] JS exception encountered calling callback: %@", [Hyperloop JSValueRefToNSException:exception]);
	}
#endif
#endif
	if (exception == NULL) {
		result = TiValueRefToId(context, jsResult, NULL);
	}
	if (args) {
		for (size_t c = 0; c < [args count]; c++) {
			TiValueUnprotect(context, jsArgs[c]);
		}
	}
	TiValueUnprotect(context, function);
	free(jsArgs);
	return result;
}

@end
