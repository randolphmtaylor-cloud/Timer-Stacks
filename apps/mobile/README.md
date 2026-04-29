# Timer Stacks — Mobile App

Expo + React Native + expo-router + NativeWind.

## Start
```bash
pnpm start
# or: npx expo start
```

Press `i` for iOS Simulator, `a` for Android, or scan with Expo Go.

## Build
```bash
pnpm build:ios
pnpm build:android
```

## Storage
All data uses `@react-native-async-storage/async-storage` under the `ts:` namespace:
- `ts:stacks` — all timer stacks
- `ts:active-sessions` — running/paused sessions
- `ts:history` — completed session records
- `ts:settings` — user preferences

## Notifications
Uses `expo-notifications`. Permissions are requested the first time a session is started.

## Future mobile-specific extensions
- **Widgets**: Read session state from shared AsyncStorage group
- **Live Activities**: Hook into session events and update ActivityKit attributes
- **Siri Shortcuts**: Expose `startStack(name:)` as an App Intent
- **Lock screen**: Live Activity shows current segment countdown
