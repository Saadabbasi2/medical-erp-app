# 🔧 Image Upload Fix - Permissions & Troubleshooting

## Issue: Image Upload Not Working

If images are not uploading, the problem is typically **missing permissions**. This has been fixed.

---

## ✅ Fixes Applied

### Android Permissions Added
**File**: `android/app/src/main/AndroidManifest.xml`

Added required permissions:
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### iOS Permissions Added
**File**: `ios/Runner/Info.plist`

Added required descriptions:
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs access to your photo library to set your profile picture</string>
<key>NSCameraUsageDescription</key>
<string>This app needs access to your camera to take a profile picture</string>
```

---

## 🚀 How to Get Image Upload Working

### Step 1: Clean Build
```bash
flutter clean
flutter pub get
```

### Step 2: Run the App
```bash
# For Android
flutter run

# Or for iOS
flutter run -d ios
```

### Step 3: Grant Permissions When Prompted
- **Android**: When you tap to add image, the app will ask for permission to access your gallery
- **iOS**: First time you try to add image, the app will ask for photo library access

### Step 4: Test Image Upload
1. Go to Settings tab
2. Click the avatar (profile picture)
3. Tap "Add Image"
4. Select a photo from your gallery
5. The image should display immediately
6. Close and reopen the app to verify it persists

---

## 🐛 Troubleshooting

### Problem: Permission Denied Error
**Solution**:
1. Go to device Settings
2. Find the app (Faizan Medicine)
3. Tap Permissions
4. Enable "Photos" or "Gallery" access
5. Restart the app
6. Try again

### Problem: Gallery/Camera Not Opening
**Solution**:
1. Verify permissions are granted in system settings
2. Try restarting the app
3. Try restarting the device
4. For Android: Clear app cache (Settings → Apps → Faizan Medicine → Storage → Clear Cache)

### Problem: Image Selected But Not Saving
**Solution**:
1. Check device storage (must have at least 50MB free)
2. Verify app has write permissions
3. Check the console for error messages:
   - Run: `flutter run` with `-v` flag to see verbose output
   - Look for "Error saving profile image" messages

### Problem: Image Disappears After Restart
**Solution**:
1. Check that images are saved in `Documents/profile_images/` directory
2. Use file explorer to verify directory exists
3. Check that `user.json` contains valid image path
4. Try deleting image and re-uploading

---

## 📱 Platform-Specific Steps

### Android

**For Android 6.0 (API 23) and higher:**
1. App will request permission at runtime
2. Tap "Allow" when permission prompt appears
3. If you denied permission, go to:
   - Settings → Apps → Faizan Medicine → Permissions
   - Enable "Photos" or "Media"
   - Restart app

**For Android 5.1 and lower:**
- Permissions are granted at install time
- No runtime permission needed

### iOS

**First Time Setup:**
1. When you tap "Add Image", iOS will prompt you
2. Tap "Allow" to give access to photo library
3. If you selected "Don't Allow", go to:
   - Settings → Faizan Medicine → Photos
   - Change from "Never" to "Read and Write"
   - Or use "Allow"

---

## ✅ Verification Checklist

After applying the fixes:

- [ ] Cleaned the project (`flutter clean`)
- [ ] Got dependencies (`flutter pub get`)
- [ ] Rebuilt the app (`flutter run`)
- [ ] Granted permissions when prompted
- [ ] Tried to add an image from gallery
- [ ] Image appeared in profile
- [ ] Closed and reopened app
- [ ] Image still appears in profile
- [ ] Can delete the image
- [ ] Can upload a new image

---

## 🔍 Debug Information

### Check Permissions on Android
```bash
adb shell pm list permissions -d
```

### Check App Permissions on Android
```bash
adb shell dumpsys package com.example.faizan_medicine | grep PERMISSION
```

### View Logs
```bash
flutter run -v
# Look for messages containing "image", "permission", or "error"
```

### Manual File Check
On device file explorer:
```
/data/data/com.example.faizan_medicine/files/
├── user.json                  ← Check this file exists
└── profile_images/            ← Check this folder exists
    └── profile_*.jpg          ← Check images are saved here
```

---

## 🎯 Expected Behavior

### When Image Upload Works Correctly

1. **Tap Avatar** → Bottom sheet appears with options
2. **Tap "Add Image"** → Gallery opens
3. **Select Photo** → Returns to app
4. **Image Displays** → Avatar shows selected image immediately
5. **Saved to File** → Image stored in Documents/profile_images/
6. **Persists** → Image shows even after closing and reopening app
7. **In user.json** → Profile path stored in Documents/user.json

### Error Messages (If Any)

These are normal - just means permission was denied:
- "Permission denied"
- "Access denied"
- "No permission to access gallery"

**Fix**: Grant permission in system settings and try again

---

## 🛠️ If Still Not Working

### Step 1: Check System Logs
```bash
flutter run -v 2>&1 | tee flutter_logs.txt
```
Look for any "Error" messages related to image or permissions.

### Step 2: Verify File Permissions
Android:
- Go to device Settings
- Apps → Faizan Medicine
- Permissions → Photos/Gallery/Files - should be "Allowed"

iOS:
- Go to device Settings
- Faizan Medicine
- Photos → should be "Read and Write"

### Step 3: Check Storage
- Verify device has at least 50MB free space
- Images are compressed before saving (should be ~100-200KB each)

### Step 4: Rebuild Everything
```bash
flutter clean
rm -rf build ios/Pods ios/Podfile.lock  # macOS/Linux
# Or on Windows: rmdir /s build ios\Pods
flutter pub get
flutter run
```

---

## 📝 What Changed

### Files Modified:
1. **android/app/src/main/AndroidManifest.xml**
   - Added 3 permission declarations
   
2. **ios/Runner/Info.plist**
   - Added 2 permission descriptions

### Code Not Changed:
- UserService works correctly
- ProfileBar implementation is correct
- No code changes needed

### The Issue Was:
- Permissions were not declared in platform config files
- App couldn't access photo library without these declarations

---

## ✨ After Fix Works Like This:

```
User taps avatar
    ↓
Bottom sheet shows options (Add, Edit, Delete)
    ↓
User taps "Add Image"
    ↓
Image picker asks for permission (first time only)
    ↓
User grants permission
    ↓
Gallery opens
    ↓
User selects photo
    ↓
Image saved to Documents/profile_images/
    ↓
user.json updated with image path
    ↓
Avatar displays image immediately
    ↓
Image persists across app restarts ✅
```

---

## 🎉 Testing

After applying the fix:

1. **Android Device**: Grant permission when prompted
2. **iOS Device**: Grant permission when prompted
3. **Simulator**: May not have real gallery (use default images)
4. **Try multiple times**: To verify image persists

---

## 💡 Tips

- **First upload may ask for permission**: This is normal and expected
- **Android emulator**: May not have gallery app by default
- **iOS simulator**: You can add test images via Xcode
- **Images are optimized**: 800x800 pixels, 80% quality = ~100-200KB each

---

## 📞 Still Need Help?

Check the console output when running `flutter run -v`:
- Look for "Error" or "Exception" messages
- Search for "image" or "permission" in the logs
- Share error messages for debugging

---

**Status**: ✅ **Fixed**

Image upload permissions have been added to both Android and iOS configuration files. The app should now request and use permissions correctly.

Try uploading an image now - it should work! 🎉
