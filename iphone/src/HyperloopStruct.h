/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

@import Foundation;

#import "define.h"

/**
 * Class that encapsulates a C struct pointer
 */
@interface HyperloopStruct : NSObject

@property(nonatomic, retain, readonly) NSString *encoding;
@property(nonatomic, retain, readonly) NSString *flatencoding;
@property(nonatomic, retain, readonly) NSMutableArray *encodings;
@property(nonatomic, assign, readonly) void *pointer;
@property(nonatomic, assign, readonly) NSUInteger size;
@property(nonatomic, retain, readonly) NSMutableDictionary *objects;

- (instancetype)initWithEncoding:(NSString *)cleanEncoding pointer:(const void *)pointer;
+ (instancetype)structWithEncoding:(NSString *)encoding pointer:(const void *)pointer;
- (id)valueAtIndex:(NSUInteger)index;
- (void)setValue:(id)v atIndex:(NSUInteger)index;
- (void)valueAtIndex:(NSUInteger)index pointer:(void *)pointer;
- (const void *)pointerValue;

@end
