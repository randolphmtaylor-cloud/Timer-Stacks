// ---------------------------------------------------------------------------
// WatchConnectivityBridgeModule.mm
//
// Objective-C++ bridge that exposes WatchConnectivityBridge (Swift) to
// React Native's bridge via RCT_EXTERN_MODULE / RCT_EXTERN_METHOD.
// The @interface prefix is required — RCT_EXTERN_MODULE expands to
// "ClassName : Superclass @end @interface ..." continuation syntax.
// ---------------------------------------------------------------------------

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface
RCT_EXTERN_MODULE(WatchConnectivityBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(sendSessionSnapshot:(NSString *)snapshotJSON
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isReachable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
