/**
 * Hyperloop Module
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
#import <Foundation/Foundation.h>
#import "define.h"

@class KrollContext;
@class KrollBridge;
@class HyperloopPointer;

@interface Hyperloop : NSObject

+(void)willStartNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge;
+(void)didStartNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge;
+(void)willStopNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge;
+(void)didStopNewContext:(KrollContext *)kroll bridge:(KrollBridge *)bridge;

+(TiObjectRef)createPointer:(HyperloopPointer *)pointer;
+(NSException*)JSValueRefToNSException:(TiValueRef)exception;

@end

