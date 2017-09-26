//
//  HyperloopPointer.h
//  hyperloop
//
//  Created by Hans Knöchel on 18.07.17.
//  Copyright © 2017 Jeff Haynie. All rights reserved.
//

@import Foundation;

#import "HyperloopStruct.h"
#import "HyperloopValue.h"

/**
 * Container that will container the underlying pointer object which will
 * aid in marshalling and unmarshalling the encoding data value into various
 * formats
 */
@interface HyperloopPointer : BASECLASS

@property (nonatomic, retain, readonly) HyperloopValue *value;
@property (nonatomic, assign, readonly) void *pointer;
@property (nonatomic, assign, readonly) BOOL assign;
@property (nonatomic, retain, readonly) NSString *encoding;
@property (nonatomic, retain, readonly) HyperloopStruct *structure;
@property (nonatomic, retain, readonly) NSString *framework;
@property (nonatomic, retain, readonly) NSString *classname;
#ifndef TIMODULE
@property (nonatomic, retain) id nativeObject;
#endif

/**
 * create a pointer to a void * pointer type with the ObjC encoding
 */
+ (instancetype)pointer:(const void *)pointer encoding:(const char *)encoding;

/**
 * create a pointer to a void * pointer type with the ObjC encoding
 */
+ (instancetype)pointer:(const void *)pointer encoding:(const char *)encoding framework:(NSString *)framework classname:(NSString *)classname;

/**
 * create a pointer to a void * pointer type with the ObjC encoding but assign the pointer. when the object
 * is dealloc, the pointer will be free'd
 */
+ (instancetype)create:(const void *)pointer encoding:(const char *)encoding;

/**
 * create a pointer to a void * pointer type with the ObjC encoding. create the pointer memory internally and
 * manage it with the lifecycle of this object.
 */
+ (instancetype)encoding:(const char *)encoding;

#define GETVALUE(type, name) \
  -(type)name##Value;        \
  +(type)name##Value : (id)value;

GETVALUE(float, float);
GETVALUE(int, int);
GETVALUE(long, long);
GETVALUE(short, short);
GETVALUE(double, double);
GETVALUE(char, char);
GETVALUE(bool, bool);
GETVALUE(long long, longLong);
GETVALUE(unsigned int, unsignedInt);
GETVALUE(unsigned long, unsignedLong);
GETVALUE(unsigned long long, unsignedLongLong);
GETVALUE(unsigned short, unsignedShort);
GETVALUE(unsigned char, unsignedChar);
GETVALUE(void *, pointer);
GETVALUE(Class, class);
GETVALUE(NSObject *, object);
GETVALUE(NSString *, selector);

#undef GETVALUE

/**
 * return the string value of the underlying pointer
 */
- (NSString *)stringValue;
+ (NSString *)stringValue:(id)arg;

/**
 * if an array, attempt to return a specific index.  this method could crash if
 * you pass overrun the size of the array or the underlying type is not a valid
 * array
 */
- (id)valueAtIndex:(NSUInteger)index;

/**
 * get value at index into pointer
 */
- (void)getValue:(NSUInteger)index pointer:(void *)pointer;

/**
 * set the value at index
 */
- (void)setValue:(id)value atIndex:(NSUInteger)index;

/**
 * set the internal pointer value
 */
- (void)setValue:(const void *)pointer encoding:(const char *)encoding assign:(BOOL)assign;

/**
 * return the size of the underlying pointer memory
 */
- (NSUInteger)length;

#define GETENC(name)           \
  -(NSString *)name##Encoding; \
  +(NSString *)name##Encoding;

GETENC(bool);
GETENC(int);
GETENC(char);
GETENC(float);
GETENC(long);
GETENC(double);
GETENC(short);
GETENC(object);
GETENC(class);
GETENC(selector);
GETENC(pointer);
GETENC(longLong);
GETENC(unsignedInt);
GETENC(unsignedChar);
GETENC(unsignedShort);
GETENC(unsignedLong);
GETENC(unsignedLongLong);
GETENC(string);
GETENC(floatPointer);
GETENC(intPointer);
GETENC(shortPointer);
GETENC(boolPointer);
GETENC(doublePointer);
GETENC(longPointer);

#undef GETENC

/**
 * set an argument for this object into invocation
 */
- (void)setArgument:(NSInvocation *)invocation atIndex:(NSUInteger)index;

@end
