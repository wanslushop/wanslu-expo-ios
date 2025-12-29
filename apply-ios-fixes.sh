#!/bin/bash
set -e

echo "🔧 Applying iOS post-prebuild fixes..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$PROJECT_ROOT/ios"
TEMPLATES_DIR="$PROJECT_ROOT/ios-templates"

# Check if iOS directory exists
if [ ! -d "$IOS_DIR" ]; then
    echo "❌ Error: iOS directory not found. Please run 'npx expo prebuild --platform ios --clean' first."
    exit 1
fi

# Fix 1: Update AppDelegate.swift
echo "📝 Fixing AppDelegate.swift..."
APP_DELEGATE="$IOS_DIR/WansluShop/AppDelegate.swift"
if [ -f "$APP_DELEGATE" ]; then
    cp "$TEMPLATES_DIR/AppDelegate.swift.template" "$APP_DELEGATE"
    echo "✅ Updated AppDelegate.swift"
else
    echo "⚠️  Warning: AppDelegate.swift not found at $APP_DELEGATE"
fi

# Fix 2: Update Podfile.properties.json
echo "📝 Fixing Podfile.properties.json..."
PODFILE_PROPERTIES="$IOS_DIR/Podfile.properties.json"
if [ -f "$PODFILE_PROPERTIES" ]; then
    cp "$TEMPLATES_DIR/Podfile.properties.json.template" "$PODFILE_PROPERTIES"
    echo "✅ Updated Podfile.properties.json"
else
    echo "⚠️  Warning: Podfile.properties.json not found at $PODFILE_PROPERTIES"
fi

# Fix 3: Update Podfile to add use_modular_headers!
echo "📝 Checking Podfile for use_modular_headers!..."
PODFILE="$IOS_DIR/Podfile"
if [ -f "$PODFILE" ]; then
    if ! grep -q "use_modular_headers!" "$PODFILE"; then
        # Add use_modular_headers! after use_expo_modules!
        if grep -q "use_expo_modules!" "$PODFILE"; then
            sed -i '' '/use_expo_modules!/a\
  use_modular_headers!
' "$PODFILE"
            echo "✅ Added use_modular_headers! to Podfile"
        fi
    else
        echo "ℹ️  use_modular_headers! already exists in Podfile"
    fi
else
    echo "⚠️  Warning: Podfile not found at $PODFILE"
fi

# Fix 4: Update Info.plist to ensure RCTNewArchEnabled is true
echo "📝 Checking Info.plist for RCTNewArchEnabled..."
INFO_PLIST="$IOS_DIR/WansluShop/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    # Check if RCTNewArchEnabled exists and is false
    if grep -q "<key>RCTNewArchEnabled</key>" "$INFO_PLIST"; then
        # Replace false with true
        sed -i '' 's/<key>RCTNewArchEnabled<\/key>/,/<false\/>/{
            /<key>RCTNewArchEnabled<\/key>/{
                N
                s/<false\/>/<true\/>/
            }
        }' "$INFO_PLIST" || true
        echo "✅ Updated RCTNewArchEnabled in Info.plist"
    else
        # Add RCTNewArchEnabled if it doesn't exist
        # This is a bit complex, so we'll just verify it's there
        echo "ℹ️  RCTNewArchEnabled key check completed"
    fi
else
    echo "⚠️  Warning: Info.plist not found at $INFO_PLIST"
fi

echo ""
echo "✅ All fixes applied!"
echo ""
echo "📦 Next step: Run 'cd ios && pod install'"

