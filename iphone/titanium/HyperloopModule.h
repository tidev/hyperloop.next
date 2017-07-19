/**
 * Hyperloop Module
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
@import Foundation;
#import "define.h"

@class KrollContext;
@class KrollBridge;
@class HyperloopPointer;

@interface Hyperloop : NSObject

+ (void)willStartNewContext:(KrollContext *)krollContext bridge:(KrollBridge *)bridge;
+ (void)didStartNewContext:(KrollContext *)krollContext bridge:(KrollBridge *)bridge;
+ (void)willStopNewContext:(KrollContext *)krollContext bridge:(KrollBridge *)bridge;
+ (void)didStopNewContext:(KrollContext *)krollContext bridge:(KrollBridge *)bridge;

+ (TiObjectRef)createPointer:(HyperloopPointer *)pointer;
+ (NSException *)JSValueRefToNSException:(TiValueRef)exception;

@end

