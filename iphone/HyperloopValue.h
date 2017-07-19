//
//  HyperloopValue.h
//  hyperloop
//
//  Created by Hans Knöchel on 18.07.17.
//  Copyright © 2017 Jeff Haynie. All rights reserved.
//

@import Foundation;

/**
 * Container that will hold the internal pointer to the value based on
 * the type of object it is.  Currently, it will either be a
 * NSString (variable size), Class, or NSValue (constant size).
 */
@interface HyperloopValue : NSObject

/**
 * The Hyperloop object.
 */
@property(nonatomic, retain, readonly) NSObject *object;

/**
 * The class of the Hyperloop object.
 */
@property(nonatomic, retain, readonly) Class clazz;

/**
 * The selector used to call the native classes.
 */
@property(nonatomic, retain, readonly) NSString *selector;

/**
 * Whether or not the Hyperloop object is a pointer.
 */
@property(nonatomic, assign, readonly, getter=isPointer) BOOL pointer;

/**
 * Create a pointer to a container object.
 *
 * @param object The container object.
 * @param isPointer Determine if the object is a pointer or not.
 * @return The instantiated class.
 */
- (instancetype)initWithObject:(NSObject *)object isPointer:(BOOL)isPointer;

/**
 * Create a pointer to a selector.
 *
 * @param selector Determine if the object is a pointer or not.
 * @return The instantiated class.
 */
- (instancetype)initWithSelector:(SEL)selector;

/**
 * Create a pointer to a container class.
 * @param className The class to be passed.
 * @return The instantiated class.
 */
- (instancetype)initWithClass:(Class)className;

/**
 * Populate the void * with the underlying pointer value.
 * @param ptr The value pointer to receive the value from.
 */
- (void)getValue:(void *)ptr;

/**
 * Returns the Hyperloop object.
 */
- (NSObject *)getObject;

/**
 * Returns the Hyperloop class-name.
 */
- (Class)getClass;

/**
 * The size of the underlying pointer memory.
 */
- (NSUInteger)length;

/**
 * Return the length for a given encoding.
 *
 * @param encoding The encoding used to count.
 * @return The length of the given encoding.
 */
+ (NSUInteger)lengthForEncoding:(const char *)encoding;

@end
