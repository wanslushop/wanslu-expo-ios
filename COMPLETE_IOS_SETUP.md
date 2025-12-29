# Complete iOS Setup - Step by Step

## Overview
This guide will help you set up the iOS project from scratch with all necessary configurations for Expo SDK 54, New Architecture, and no dev-client.

## Prerequisites
- Node.js and npm installed
- Expo CLI installed (`npm install -g expo-cli` or use `npx`)
- Xcode installed (for iOS builds)
- CocoaPods installed (`sudo gem install cocoapods`)

## Step-by-Step Instructions

### Step 1: Clean and Run Prebuild

Open terminal in the project root and run:

```bash
cd /Users/chiragpipal/Desktop/wanslu-expo-app

# Remove existing iOS folder if it exists
rm -rf ios

# Run Expo prebuild
npx expo prebuild --platform ios --clean
```

This will generate a fresh iOS project based on your `app.json` configuration.

### Step 2: Verify Generated Files

After prebuild, check that these files exist:
- `ios/WansluShop/AppDelegate.swift`
- `ios/Podfile`
- `ios/Podfile.properties.json`
- `ios/WansluShop/Info.plist`

### Step 3: Apply Post-Prebuild Fixes

After prebuild, you need to apply fixes to ensure everything works correctly. See the sections below for each file.

### Step 4: Install CocoaPods Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 5: Verify Build

After all fixes are applied, your project should be ready to build.

---

## Post-Prebuild Fixes

### Fix 1: AppDelegate.swift

The AppDelegate should be a simple ExpoAppDelegate. If it contains dev-client code, replace it with:

```swift
import ExpoModulesCore
import React

@main
class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.moduleName = "main"
    self.initialProps = [:]
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}
```

### Fix 2: Podfile.properties.json

Ensure this file contains:

```json
{
  "expo.jsEngine": "hermes",
  "newArchEnabled": "true"
}
```

### Fix 3: Podfile

Ensure the Podfile includes `use_modular_headers!` after `use_expo_modules!`:

```ruby
target 'WansluShop' do
  use_expo_modules!
  use_modular_headers!
  
  # ... rest of Podfile
end
```

### Fix 4: Info.plist

Verify that `RCTNewArchEnabled` is set to `true`:

```xml
<key>RCTNewArchEnabled</key>
<true/>
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] `app.json` has `newArchEnabled: true` and `devClient: false`
- [ ] `AppDelegate.swift` doesn't contain any dev-client code
- [ ] `Podfile.properties.json` has `newArchEnabled: "true"`
- [ ] `Podfile` includes `use_modular_headers!`
- [ ] `Info.plist` has `RCTNewArchEnabled` set to `true`
- [ ] Pods installed successfully with `pod install`
- [ ] No build errors when running `npx expo run:ios`

---

## Troubleshooting

### If you see "reactNativeFactory" error:
- Make sure AppDelegate.swift is using standard ExpoAppDelegate (no dev-client code)
- Remove any references to `ExpoReactNativeFactory` or `ExpoReactDelegate`

### If Reanimated build fails:
- Ensure New Architecture is enabled in all config files
- Verify `newArchEnabled: true` in app.json and Podfile.properties.json

### If Hermes errors occur:
- Don't manually set Hermes in Podfile ENV variables
- Let Expo manage Hermes via `expo.jsEngine` in Podfile.properties.json

---

## Next Steps

Once everything is set up:
1. Test locally: `npx expo run:ios`
2. Build with EAS: `eas build --platform ios`
3. The build cache is already disabled in `eas.json` for clean builds

