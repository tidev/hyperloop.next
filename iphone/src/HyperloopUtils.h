/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

@import Foundation;

#import "define.h"

@class KrollContext;

@interface HyperloopUtils : NSObject

/**
 * given an argument for an NSInvocation, attempt to unmarshal any special
 * argument types and set them in the invocation at index
 */
+ (id)unmarshalObject:(NSInvocation *)invocation arg:(id)arg index:(NSUInteger)index;

/**
 * invoke a selector and return the result
 */
+ (id)invokeSelector:(SEL)aSelector args:(NSArray *)args target:(id)obj instance:(BOOL)instanceMethod;

/**
 * invoke a callback
 */
+ (void)invokeCallback:(id)callback args:(NSArray *)args thisObject:(id)thisObject;

/**
 * invoke a custom callback and return a result (if specified)
 */
+ (id)invokeCustomCallback:(NSArray *)args identifier:(NSString *)identifier thisObject:(id)thisObject;

/**
 * attempt to return a string value for object val
 */
+ (NSString *)stringify:(id)val;

/**
 * attempt to return a boolean value for object val
 */
+ (BOOL)booleanify:(id)val;

@end

