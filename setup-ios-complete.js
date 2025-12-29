#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;

console.log('🚀 Starting complete iOS setup from scratch...\n');

// Step 1: Clean up iOS folder
console.log('🧹 Step 1: Cleaning up existing iOS folder...');
const iosPath = path.join(projectRoot, 'ios');
if (fs.existsSync(iosPath)) {
    fs.rmSync(iosPath, { recursive: true, force: true });
    console.log('✅ Removed existing iOS folder\n');
} else {
    console.log('ℹ️  No existing iOS folder to remove\n');
}

// Step 2: Run prebuild
console.log('📦 Step 2: Running Expo prebuild for iOS...');
try {
    execSync('npx expo prebuild --platform ios --clean', {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: undefined }
    });
    console.log('\n✅ Prebuild completed successfully!\n');
} catch (error) {
    console.error('\n❌ Prebuild failed:', error.message);
    process.exit(1);
}

// Step 3: Verify AppDelegate exists
const appDelegatePath = path.join(iosPath, 'WansluShop', 'AppDelegate.swift');
if (!fs.existsSync(appDelegatePath)) {
    console.error('❌ Error: AppDelegate.swift not found after prebuild');
    process.exit(1);
}

console.log('✅ iOS project generated successfully!');
console.log('\n📝 Next steps:');
console.log('1. Verify AppDelegate.swift is correct');
console.log('2. Update Podfile.properties.json if needed');
console.log('3. Run: cd ios && pod install');

