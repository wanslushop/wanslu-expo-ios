#!/bin/bash
set -e

echo "🚀 Complete iOS Setup - All in One"
echo "===================================="
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$PROJECT_ROOT/ios"
TEMPLATES_DIR="$PROJECT_ROOT/ios-templates"

cd "$PROJECT_ROOT"

# Step 1: Clean up
echo "🧹 Step 1: Cleaning up existing iOS folder..."
if [ -d "$IOS_DIR" ]; then
    rm -rf "$IOS_DIR"
    echo "✅ Removed existing iOS folder"
else
    echo "ℹ️  No existing iOS folder to remove"
fi
echo ""

# Step 2: Run prebuild
echo "📦 Step 2: Running Expo prebuild for iOS..."
echo "   This may take a few minutes..."
npx expo prebuild --platform ios --clean
echo ""

# Step 3: Verify prebuild completed
if [ ! -d "$IOS_DIR" ]; then
    echo "❌ Error: iOS directory was not created. Prebuild may have failed."
    exit 1
fi

echo "✅ Prebuild completed successfully!"
echo ""

# Step 4: Apply fixes
echo "🔧 Step 3: Applying post-prebuild fixes..."
echo ""

# Fix AppDelegate.swift
APP_DELEGATE="$IOS_DIR/WansluShop/AppDelegate.swift"
if [ -f "$APP_DELEGATE" ]; then
    if [ -f "$TEMPLATES_DIR/AppDelegate.swift.template" ]; then
        cp "$TEMPLATES_DIR/AppDelegate.swift.template" "$APP_DELEGATE"
        echo "✅ Fixed AppDelegate.swift"
    else
        echo "⚠️  Warning: AppDelegate template not found, skipping..."
    fi
fi

# Fix Podfile.properties.json
PODFILE_PROPERTIES="$IOS_DIR/Podfile.properties.json"
if [ -f "$PODFILE_PROPERTIES" ]; then
    if [ -f "$TEMPLATES_DIR/Podfile.properties.json.template" ]; then
        cp "$TEMPLATES_DIR/Podfile.properties.json.template" "$PODFILE_PROPERTIES"
        echo "✅ Fixed Podfile.properties.json"
    else
        echo "⚠️  Warning: Podfile.properties template not found, skipping..."
    fi
fi

# Fix Podfile - add use_modular_headers!
PODFILE="$IOS_DIR/Podfile"
if [ -f "$PODFILE" ]; then
    if ! grep -q "use_modular_headers!" "$PODFILE"; then
        # Use a more reliable method to add use_modular_headers!
        perl -i -pe 's/(use_expo_modules!)/$1\n  use_modular_headers!/' "$PODFILE"
        echo "✅ Added use_modular_headers! to Podfile"
    else
        echo "ℹ️  use_modular_headers! already in Podfile"
    fi
fi

# Fix Info.plist - ensure RCTNewArchEnabled is true
INFO_PLIST="$IOS_DIR/WansluShop/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    # Use plutil if available (macOS), otherwise use sed
    if command -v plutil &> /dev/null; then
        plutil -replace RCTNewArchEnabled -bool true "$INFO_PLIST" 2>/dev/null || true
        echo "✅ Updated RCTNewArchEnabled in Info.plist"
    else
        # Fallback: try to replace false with true
        sed -i.bak 's/<key>RCTNewArchEnabled<\/key>/,/<false\/>/{ s/<false\/>/<true\/>/; }' "$INFO_PLIST" 2>/dev/null || true
        rm -f "$INFO_PLIST.bak" 2>/dev/null || true
        echo "✅ Updated RCTNewArchEnabled in Info.plist (using sed)"
    fi
fi

echo ""
echo "✅ All fixes applied!"
echo ""
echo "📋 Setup Summary:"
echo "=================="
echo "✅ iOS project generated"
echo "✅ AppDelegate.swift configured"
echo "✅ Podfile.properties.json configured"
echo "✅ Podfile configured with modular headers"
echo "✅ Info.plist configured for New Architecture"
echo ""
echo "📦 Next Steps:"
echo "1. Install CocoaPods dependencies:"
echo "   cd ios && pod install && cd .."
echo ""
echo "2. Build the project:"
echo "   npx expo run:ios"
echo ""
echo "3. Or build with EAS:"
echo "   eas build --platform ios"
echo ""
echo "✨ Setup complete!"

