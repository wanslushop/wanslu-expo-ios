# 🚀 Complete iOS Setup - Ready to Run

All files are prepared! Follow the instructions below to set up your iOS project from scratch.

## Quick Start (Recommended)

Run this single command:

```bash
cd /Users/chiragpipal/Desktop/wanslu-expo-app
chmod +x setup-ios-all-in-one.sh
./setup-ios-all-in-one.sh
```

This script will:
1. ✅ Clean up any existing iOS folder
2. ✅ Run `npx expo prebuild --platform ios --clean`
3. ✅ Apply all necessary fixes automatically
4. ✅ Configure everything correctly

## Manual Setup (Alternative)

If you prefer to run commands manually:

### Step 1: Run Prebuild
```bash
cd /Users/chiragpipal/Desktop/wanslu-expo-app
rm -rf ios
npx expo prebuild --platform ios --clean
```

### Step 2: Apply Fixes
```bash
chmod +x apply-ios-fixes.sh
./apply-ios-fixes.sh
```

### Step 3: Install Pods
```bash
cd ios
pod install
cd ..
```

## What Gets Fixed Automatically

After prebuild, the setup script automatically fixes:

1. **AppDelegate.swift** - Removes dev-client code, uses standard ExpoAppDelegate
2. **Podfile.properties.json** - Sets `newArchEnabled: "true"` and configures Hermes
3. **Podfile** - Adds `use_modular_headers!` for Firebase compatibility
4. **Info.plist** - Ensures `RCTNewArchEnabled` is set to `true`

## Verification

After running the setup, verify:

- [x] `app.json` has `newArchEnabled: true` and `devClient: false` ✅
- [ ] `ios/WansluShop/AppDelegate.swift` exists and has no dev-client code
- [ ] `ios/Podfile.properties.json` has `newArchEnabled: "true"`
- [ ] `ios/Podfile` includes `use_modular_headers!`
- [ ] `ios/WansluShop/Info.plist` has `RCTNewArchEnabled` set to `true`
- [ ] Pods installed successfully

## Current Configuration

Your project is already configured correctly:

- ✅ **app.json**: New Architecture enabled, dev-client disabled
- ✅ **eas.json**: Build cache disabled for all profiles
- ✅ **Templates**: All fix templates ready in `ios-templates/` folder

## Next Steps After Setup

1. **Test locally:**
   ```bash
   npx expo run:ios
   ```

2. **Build with EAS:**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Verify build succeeds** - All three original errors should be fixed:
   - ✅ No more `reactNativeFactory` error
   - ✅ Reanimated builds correctly with New Architecture
   - ✅ No Hermes runtime redefinition errors

## Troubleshooting

### If the setup script fails:
- Make sure you have Node.js, npm, and Expo CLI installed
- Check that you're in the project root directory
- Verify Xcode and CocoaPods are installed

### If you see errors after setup:
- Check `COMPLETE_IOS_SETUP.md` for detailed troubleshooting
- Ensure all files were generated correctly
- Try cleaning and rebuilding: `cd ios && rm -rf Pods Podfile.lock && pod install`

## Files Created

- `setup-ios-all-in-one.sh` - Main setup script (run this!)
- `apply-ios-fixes.sh` - Post-prebuild fixes only
- `COMPLETE_IOS_SETUP.md` - Detailed documentation
- `ios-templates/` - Template files for fixes

---

**Ready to go?** Run `./setup-ios-all-in-one.sh` and let it do everything! 🎉

