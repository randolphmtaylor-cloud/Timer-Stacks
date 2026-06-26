# Xcode Deployment Guide

Deploy Timer Stacks to your personal iPhone and Apple Watch using this guide.

---

## Required Software

| Tool | Required Version | Install Command |
|------|-----------------|-----------------|
| Xcode | 16.x+ | App Store |
| CocoaPods | 1.16.2+ | See below |
| Ruby | 4.0.5 (Homebrew) | `brew install ruby` |
| Node.js | 18+ | `brew install node` |
| pnpm | 9+ | `npm i -g pnpm` |

**Install Ruby 4 and CocoaPods:**
```bash
brew install ruby
# Add to shell profile:
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
/opt/homebrew/lib/ruby/gems/4.0.0/bin/gem install cocoapods
```

**Symlink required (path-with-spaces workaround):**
```bash
ln -s "/Users/$USER/App Projects/Timer Stacks" "$HOME/TimerStacks"
```
This symlink must exist before running pod install. React Native's build scripts break on directory names with spaces.

---

## One-Time Setup

```bash
# 1. Install JS dependencies
cd "/Users/$USER/App Projects/Timer Stacks"
pnpm install

# 2. Install iOS pods (use symlinked path and Homebrew Ruby)
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
  /opt/homebrew/lib/ruby/gems/4.0.0/bin/pod install \
  --project-directory="$HOME/TimerStacks/apps/mobile/ios"
```

---

## Opening the Workspace

Open the unified workspace that contains both the iPhone and Watch targets:

```
TimerStacks.xcworkspace
```

Located at the repo root: `/Users/$USER/App Projects/Timer Stacks/TimerStacks.xcworkspace`

**Do NOT open `apps/mobile/ios/TimerStacks.xcworkspace` or `apps/watch/TimerStacksWatchApp.xcodeproj` individually** — use the root workspace so both targets are available together.

---

## Signing

1. Open `TimerStacks.xcworkspace` in Xcode
2. Select the **TimerStacks** target → **Signing & Capabilities**
3. Check **Automatically manage signing**
4. Set **Team** to your personal Apple ID team
5. Repeat for the **TimerStacksWatchApp** target and its **Extension** sub-target

Bundle identifiers:
- iPhone app: `com.timerstacks.app`
- Watch app: `com.timerstacks.app.watchkitapp`
- Watch extension: `com.timerstacks.app.watchkitapp.watchkitextension` *(if present)*

---

## Deploying to iPhone

1. Plug in your iPhone via USB
2. Trust the computer on the device if prompted
3. Select your iPhone in the Xcode device picker (top toolbar)
4. Choose the **TimerStacks** scheme
5. Press **Run** (⌘R)

Xcode will install the app directly. No TestFlight or App Store account needed for personal device deployment.

---

## Deploying to Apple Watch

The Watch app deploys automatically when the iPhone app is installed, provided:

- Your Apple Watch is paired with the iPhone you are deploying to
- The Watch is on your wrist and unlocked (or unlocked via iPhone)
- Xcode sees both devices (the Watch appears indented under the iPhone in the device list)

If the Watch does not appear:
1. Open **Window → Devices and Simulators**
2. Select your iPhone — the paired Watch should appear
3. If the Watch shows "Unpaired", open the Watch app on iPhone and pair it

To install Watch app separately:
1. Select your Apple Watch in the device picker (it appears nested under the iPhone)
2. Choose the **TimerStacksWatchApp** scheme
3. Press **Run** (⌘R)

---

## Rebuilding After JS/pnpm Changes

You do not need to re-run pod install after changing TypeScript/JS files. Just press **Run** in Xcode — Metro bundler packs the JS at build time.

Re-run pod install only when:
- `package.json` dependencies change (`pnpm install` first, then pod install)
- Native iOS files are added/removed
- Expo SDK version changes

---

## Common Build Errors

### "No such file or directory: .../App Projects/..."
React Native's build scripts broke on the space in the project path.
**Fix:** Ensure the symlink exists: `ln -s "/Users/$USER/App Projects/Timer Stacks" "$HOME/TimerStacks"`

### "Redefinition of module 'ReactCommon'"
Caused by `use_modular_headers!` applied globally in the Podfile.
**Fix:** The Podfile already targets only `React-jsinspector`. If this reappears after a fresh prebuild, restore the targeted override.

### Pod install fails with Ruby error
**Fix:** Use Homebrew Ruby 4, not system Ruby 2.6:
```bash
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
/opt/homebrew/lib/ruby/gems/4.0.0/bin/pod install ...
```

### "PhaseScriptExecution failed" on EXConstants
Expo's `get-app-config-ios.sh` script phase uses `bash -l -c "..."` which breaks with spaces.
**Fix:** The `EXConstants.podspec` in node_modules has been patched to use `bash -l "..."` (no `-c`). This patch is in the repo but will be lost if pnpm recreates node_modules. Re-apply if needed:
```
node_modules/.pnpm/expo-constants@16.0.2_.../node_modules/expo-constants/ios/EXConstants.podspec
line 39: change  bash -l -c "..."  →  bash -l "..."
```

### Signing: "No profiles for 'com.timerstacks.app' were found"
Xcode needs internet access to create a development profile.
**Fix:** Sign in to your Apple ID in Xcode → Settings → Accounts, then let Xcode manage signing automatically.

### Watch app not appearing on device
**Fix:** The Watch must be awake and unlocked. Try tapping the Watch screen, then wait ~30s for Xcode to detect it.

---

## Re-running Pod Install (Full Clean)

```bash
cd "/Users/$USER/App Projects/Timer Stacks"
pnpm install

rm -rf "$HOME/TimerStacks/apps/mobile/ios/Pods"
rm -f  "$HOME/TimerStacks/apps/mobile/ios/Podfile.lock"

export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
  /opt/homebrew/lib/ruby/gems/4.0.0/bin/pod install \
  --project-directory="$HOME/TimerStacks/apps/mobile/ios"
```

Then clean DerivedData in Xcode: **Product → Clean Build Folder** (⇧⌘K).

---

## Workspace Path Reference

```
/Users/<you>/App Projects/Timer Stacks/
├── TimerStacks.xcworkspace          ← OPEN THIS
├── apps/
│   ├── mobile/ios/
│   │   ├── TimerStacks.xcworkspace  (iOS + CocoaPods — included by root workspace)
│   │   ├── Podfile
│   │   └── TimerStacks/             (native source + bridging headers)
│   └── watch/
│       └── TimerStacksWatchApp.xcodeproj  (Watch app — included by root workspace)
└── packages/
    ├── core/                         (pure TS timer engine)
    └── storage/                      (storage interfaces)
```
