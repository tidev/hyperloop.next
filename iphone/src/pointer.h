/**
 * Hyperloop iOS-Core
 * Copyright (c) 2015-present by Appcelerator, Inc.
 */
#import <Foundation/Foundation.h>
#import "define.h"

/**
 * class that encapsulates a C struct pointer
 */
@interface HyperloopStruct : NSObject

@property (nonatomic, retain, readonly) NSString *encoding;
@property (nonatomic, retain, readonly) NSString *flatencoding;
@property (nonatomic, retain, readonly) NSMutableArray *encodings;
@property (nonatomic, assign, readonly) void *pointer;
@property (nonatomic, assign, readonly) NSUInteger size;
@property (nonatomic, retain, readonly) NSMutableDictionary *objects;


-(instancetype)initWithEncoding:(NSString *)cencoding pointer:(const void *)pointer;
+(instancetype)structWithEncoding:(NSString *)encoding pointer:(const void *)pointer;
-(id)valueAtIndex:(NSUInteger)index;
-(void)setValue:(id)v atIndex:(NSUInteger)index;
-(void)valueAtIndex:(NSUInteger)index pointer:(void *)pointer;
-(const void*)pointerValue;

@end

/**
 * Container that will hold the internal pointer to the value based on
 * the type of object it is.  Currently, it will either be a
 * NSString (variable size), Class, or NSValue (constant size).
 */
@interface HyperloopValue : NSObject

@property (nonatomic, retain, readonly) NSObject *object;
@property (nonatomic, retain, readonly) Class clazz;
@property (nonatomic, retain, readonly) NSString *selector;
@property (nonatomic, assign, readonly, getter = isPointer) BOOL pointer;

/**
 * create a pointer to a container object
 */
-(instancetype)initWithObject:(NSObject *)object isPointer:(BOOL)isPointer;

/**
 * create a pointer to a container class
 */
-(instancetype)initWithClass:(Class)cls;

/**
 * populate the void * with the underlying pointer value
 */
-(void)getValue:(void *)ptr;

/**
 * return the size of the underlying pointer memory
 */
-(NSUInteger)length;

@end


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
@property (nonatomic, retain, readonly) HyperloopStruct * structure;
@property (nonatomic, retain, readonly) NSString *framework;
@property (nonatomic, retain, readonly) NSString *classname;
#ifndef TIMODULE
@property (nonatomic, retain) id nativeObject;
#endif


/**
 * create a pointer to a void * pointer type with the ObjC encoding
 */
+(instancetype)pointer:(const void *)pointer encoding:(const char *)encoding;

/**
 * create a pointer to a void * pointer type with the ObjC encoding
 */
+(instancetype)pointer:(const void *)pointer encoding:(const char *)encoding framework:(NSString *)framework classname:(NSString *)classname;

/**
 * create a pointer to a void * pointer type with the ObjC encoding but assign the pointer. when the object
 * is dealloc, the pointer will be free'd
 */
+(instancetype)create:(const void *)pointer encoding:(const char *)encoding;

/**
 * create a pointer to a void * pointer type with the ObjC encoding. create the pointer memory internally and
 * manage it with the lifecycle of this object.
 */
+(instancetype)encoding:(const char *)encoding;


#define GETVALUE(type, name) \
-(type)name##Value;\
+(type)name##Value:(id)value;

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
-(NSString*)stringValue;
+(NSString*)stringValue:(id)arg;

/**
 * if an array, attempt to return a specific index.  this method could crash if
 * you pass overrun the size of the array or the underlying type is not a valid
 * array
 */
-(id)valueAtIndex:(NSUInteger)index;

/**
 * get value at index into pointer
 */
-(void)getValue:(NSUInteger)index pointer:(void *)pointer;

/**
 * set the value at index
 */
-(void)setValue:(id)value atIndex:(NSUInteger)index;

/**
 * set the internal pointer value
 */
-(void)setValue:(const void *)pointer encoding:(const char *)encoding assign:(BOOL)assign;

/**
 * return the size of the underlying pointer memory
 */
-(NSUInteger)length;


#define GETENC(name) \
-(NSString *)name##Encoding;\
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
-(void)setArgument:(NSInvocation *)invocation atIndex:(NSUInteger)index;

@end
