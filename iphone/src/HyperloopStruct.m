/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

@import UIKit;

#import "HyperloopStruct.h"
#import "HyperloopPointer.h"
#import "HyperloopUtils.h"
#ifdef TIMODULE
#import "HyperloopView.h"
#endif

#define DEALLOC_DEBUG 0

@implementation HyperloopStruct

- (instancetype)initWithEncoding:(NSString *)cleanEncoding pointer:(const void *)pointer
{
  if (self = [self init]) {
    if (!pointer) {
      @throw [NSException exceptionWithName:@"InvalidArgument" reason:@"pointer cannot be NULL" userInfo:nil];
    }
    _encoding = cleanupEncoding(cleanEncoding);
    _encodings = [[NSMutableArray alloc] init];
    _flatencoding = stringWithoutGarbage(_encoding);
    _objects = [[NSMutableDictionary alloc] init];
    _size = 0;

#define GETENC(type, enc)                                                     \
  case enc: {                                                                 \
    [_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(type)]]; \
    _size += sizeof(type);                                                    \
    break;                                                                    \
  }

    for (NSUInteger i = 0; i < [_flatencoding length]; i++) {
      const char ch = [_flatencoding characterAtIndex:i];
      switch (ch) {
        GETENC(double, 'd');
        GETENC(int, 'i');
        GETENC(float, 'f');
        GETENC(long, 'l');
        GETENC(short, 's');
        GETENC(bool, 'B');
        GETENC(char, 'c');
        GETENC(long long, 'q');
        GETENC(unsigned char, 'C');
        GETENC(unsigned int, 'I');
        GETENC(unsigned short, 'S');
        GETENC(unsigned long, 'L');
        GETENC(unsigned long long, 'Q');
      case '*': {
        //TODO: not sure this is correct
        [_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(char *)]];
        _size += sizeof(char *);
        break;
      }
      case '@': {
        [_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(id)]];
        _size += sizeof(id);
        break;
      }
      case '#': {
        [_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(Class)]];
        _size += sizeof(Class);
        break;
      }
      case ':': {
        [_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(SEL)]];
        _size += sizeof(SEL);
        break;
      }
      case '^': {
        i++;
        [_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(void *)]];
        _size += sizeof(void *);
        break;
      }
      }
    }
    if (_size) {
      _pointer = malloc(_size);
      memset(_pointer, '\0', _size);
      memcpy(_pointer, pointer, _size);
    }
  }
  REMEMBER(self);
  return self;
}

+ (instancetype)structWithEncoding:(NSString *)encoding pointer:(const void *)_pointer
{
  return [[HyperloopStruct alloc] initWithEncoding:encoding pointer:_pointer];
}

- (void)setValue:(const void *)value
{
  memcpy(_pointer, value, _size);
}

- (id)iterate:(NSUInteger)index callback:(id (^)(char ch, void *tmp))callback
{
  void *tmp = _pointer;
  for (NSUInteger i = 0; i <= index; i++) {
    NSNumber *enc = [_encodings objectAtIndex:i];
    if (i == index) {
      char ch = [_flatencoding characterAtIndex:i];
      if (ch == '^') {
        i++;
      }
      return callback(ch, tmp);
    }
    tmp += [enc unsignedIntegerValue];
  }
  return nil;
}

- (id)valueAtIndex:(NSUInteger)index
{
  return [self iterate:index
              callback:^id(char ch, void *p) {
                switch (ch) {
                case 'd':
                  return [NSNumber numberWithDouble:*(double *)p];
                case 'i':
                  return [NSNumber numberWithInt:*(int *)p];
                case 'l':
                  return [NSNumber numberWithLong:*(long *)p];
                case 's':
                  return [NSNumber numberWithShort:*(short *)p];
                case 'f':
                  return [NSNumber numberWithFloat:*(float *)p];
                case 'B':
                  return [NSNumber numberWithBool:*(bool *)p];
                case 'c':
                  return [NSNumber numberWithChar:*(char *)p];
                case 'q':
                  return [NSNumber numberWithLongLong:*(long long *)p];
                case 'C':
                  return [NSNumber numberWithUnsignedChar:*(unsigned char *)p];
                case 'I':
                  return [NSNumber numberWithUnsignedInt:*(unsigned int *)p];
                case 'S':
                  return [NSNumber numberWithUnsignedShort:*(unsigned short *)p];
                case 'L':
                  return [NSNumber numberWithUnsignedLong:*(unsigned long *)p];
                case 'Q':
                  return [NSNumber numberWithUnsignedLongLong:*(unsigned long long *)p];
                case ':': {
                  id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
                  if ([obj isKindOfClass:[NSString class]]) {
                    SEL sel = NSSelectorFromString(obj);
                    return [HyperloopPointer pointer:sel encoding:@encode(SEL)];
                  } else {
                    NSLog(@"[ERROR] Not sure what type of object SEL is at %lu", (unsigned long)index);
                  }
                  break;
                }
                case '#':
                case '^':
                case '@': {
                  id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
                  return [HyperloopPointer pointer:(__bridge const void *)(obj)encoding:[[NSString stringWithFormat:@"%c", ch] UTF8String]];
                }
                default:
                  break;
                }
                return nil;
              }];
}

- (void)valueAtIndex:(NSUInteger)index pointer:(void *)ptr
{
  __block void **resultp = (void **)ptr;

  [self iterate:index
       callback:^id(char ch, void *p) {
         switch (ch) {
         case 'd':
           *(double *)ptr = [[NSNumber numberWithDouble:*(double *)p] doubleValue];
           break;
         case 'i':
           *(int *)ptr = [[NSNumber numberWithInt:*(int *)p] intValue];
           break;
         case 'l':
           *(long *)ptr = [[NSNumber numberWithLong:*(long *)p] longValue];
           break;
         case 's':
           *(short *)ptr = [[NSNumber numberWithLong:*(short *)p] shortValue];
           break;
         case 'f':
           *(float *)ptr = [[NSNumber numberWithDouble:*(float *)p] floatValue];
           break;
         case 'B':
           *(bool *)ptr = [[NSNumber numberWithBool:*(bool *)p] boolValue];
           break;
         case 'c':
           *(char *)ptr = [[NSNumber numberWithChar:*(char *)p] charValue];
           break;
         case 'q':
           *(long long *)ptr = [[NSNumber numberWithLongLong:*(long long *)p] longLongValue];
           break;
         case 'C':
           *(unsigned char *)ptr = [[NSNumber numberWithUnsignedChar:*(unsigned char *)p] unsignedCharValue];
           break;
         case 'I':
           *(unsigned int *)ptr = [[NSNumber numberWithUnsignedInt:*(unsigned int *)p] unsignedIntValue];
           break;
         case 'S':
           *(unsigned short *)ptr = [[NSNumber numberWithUnsignedShort:*(unsigned short *)p] unsignedShortValue];
           break;
         case 'L':
           *(unsigned long *)ptr = [[NSNumber numberWithUnsignedLong:*(unsigned long *)p] unsignedLongValue];
           break;
         case 'Q':
           *(unsigned long long *)ptr = [[NSNumber numberWithUnsignedLongLong:*(unsigned long long *)p] unsignedLongLongValue];
           break;
         case ':': {
           id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
           if ([obj isKindOfClass:[NSString class]]) {
             *(SEL *)ptr = NSSelectorFromString(obj);
           } else {
             NSLog(@"[ERROR] Not sure what type of object SEL is at %lu", (unsigned long)index);
           }
           break;
         }
         case '#':
         case '^':
         case '@': {
           id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
           // must retain since the other since will autorelease it
           *resultp = (__bridge_retained void *)(obj);
           break;
         }
         default:
           break;
         }
         return nil;
       }];
}

- (void)setValue:(id)v atIndex:(NSUInteger)index
{
#define SETVAL(t, type, n)                      \
  case t: {                                     \
    *(type *)p = [HyperloopPointer n##Value:v]; \
    return nil;                                 \
  }

  [self iterate:index
       callback:^id(char ch, void *p) {
         switch (ch) {
           SETVAL('d', double, double);
           SETVAL('i', int, int);
           SETVAL('I', unsigned int, unsignedInt);
           SETVAL('s', short, short);
           SETVAL('S', unsigned short, unsignedShort);
           SETVAL('f', float, float);
           SETVAL('l', long, long);
           SETVAL('L', unsigned long, unsignedLong);
           SETVAL('c', char, char);
           SETVAL('q', long long, longLong);
           SETVAL('Q', unsigned long long, unsignedLongLong);
           SETVAL('B', bool, bool);
           SETVAL('C', unsigned char, unsignedChar);
         case '@':
         case '#':
         case '*': {
           [_objects setObject:v forKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
           break;
         }
         case ':': {
           if ([v isKindOfClass:[NSString class]]) {
             [_objects setObject:v forKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
           } else {
             NSLog(@"[ERROR] not sure how to handle SEL type of class %@", [v class]);
           }
           break;
         }
         case '^': {
           if ([v isKindOfClass:[HyperloopPointer class]]) {
             [_objects setObject:v forKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
           } else {
             NSLog(@"[ERROR] not sure how to handle pointer type of class %@", [v class]);
           }
           break;
         }
         default:
           break;
         }
         return nil;
       }];
}

- (const void *)pointerValue
{
  return _pointer;
}

- (void)dealloc
{
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
  NSLog(@"dealloc %p -> %@", self, self);
#endif
  RELEASE_AND_CHECK(_encoding);
  RELEASE_AND_CHECK(_encodings);
  RELEASE_AND_CHECK(_flatencoding);
  RELEASE_AND_CHECK(_objects);
  free(_pointer);
  _pointer = nil;
  FORGET(self);
}

@end
