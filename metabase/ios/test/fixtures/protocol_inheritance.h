@protocol BaseProtocol <NSObject>

@property float a;
- (void)b;

@end

@protocol MyProtocol <BaseProtocol>

- (void)c;

@end
