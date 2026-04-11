# User Profile Management Implementation Guide

## Quick Start

The user profile management system is now fully integrated into the Faizan Medicine app. Users can edit their profile (username and profile picture) with persistent storage.

## What Changed

### New Service: `UserService`
Location: `lib/services/user_service.dart`

This service handles all user profile operations:
- Loading user data from `user.json`
- Saving profile images to the documents directory
- Updating user information
- Deleting profile images

### Updated Widgets

**ProfileBar** (`lib/widgets/profile_bar.dart`)
- Now loads and displays user data from UserService
- Allows editing username via modal dialog
- Supports image selection, editing, and deletion
- Shows profile image or default avatar

### Updated Screens

**Login Screen** (`lib/screens/login.dart`)
- Initializes user profile on first login
- Extracts username from email if not already set

**Settings Screen** (`lib/screens/settings.dart`)
- Displays editable ProfileBar at the top
- Users can access profile editing from here

### Updated Main App

**main.dart**
- Loads user data on app startup via `UserService.loadUser()`

## How to Use

### For Users

1. **Login**
   - Enter email and password on login screen
   - Username is automatically extracted from email prefix

2. **Edit Profile**
   - Go to Settings tab
   - Click the edit icon next to username
   - Edit username in the dialog and save
   - Or click the avatar to add/change profile picture

3. **Manage Profile Picture**
   - Click the avatar in ProfileBar
   - Select "Add Image" to upload a photo
   - Select "Edit Image" to change existing photo
   - Select "Delete Image" to remove photo

### For Developers

#### Loading User Data
```dart
final user = await UserService.loadUser();
print(user['username']);      // 'john'
print(user['profileImagePath']); // '/path/to/image.jpg'
```

#### Updating User Profile
```dart
// Update username only
await UserService.updateUserProfile(username: 'newname');

// Update profile image
await UserService.updateUserProfile(profileImagePath: '/path/to/new/image.jpg');

// Update both
await UserService.updateUserProfile(
  username: 'newname',
  profileImagePath: '/path/to/new/image.jpg',
);
```

#### Saving an Image
```dart
final savedPath = await UserService.saveProfileImage('/path/to/original/image.jpg');
if (savedPath != null) {
  await UserService.updateUserProfile(profileImagePath: savedPath);
}
```

#### Clearing Cache
```dart
UserService.clearCache(); // Useful when logging out
```

## Data Storage

### File Structure
```
App Documents Directory (getApplicationDocumentsDirectory())
├── user.json
└── profile_images/
    ├── profile_1699610000000.jpg
    └── profile_1699610001000.jpg
```

### user.json Format
```json
{
  "username": "johndoe",
  "profileImagePath": "/data/data/.../documents/profile_images/profile_1699610000000.jpg"
}
```

## Key Features

✅ **Persistent Storage**
- User data survives app restarts
- Images stored in documents directory

✅ **Image Management**
- Images optimized before saving (800x800, quality 80)
- Old images automatically cleaned up
- Valid image path verification

✅ **Error Handling**
- Graceful fallback to defaults on errors
- User-friendly error messages
- File existence validation

✅ **Performance**
- Cached user data for fast access
- Async operations to prevent UI blocking
- Efficient file operations

✅ **Security**
- No sensitive data hardcoded
- Proper file permissions (platform-handled)
- No asset file modifications

## Error Scenarios Handled

1. **Missing user.json**
   - Returns default user with username: 'User'

2. **Missing Profile Image**
   - Automatically removes invalid path from JSON
   - Shows default avatar

3. **File I/O Errors**
   - Caught and reported to user
   - Graceful degradation

4. **Image Save Failures**
   - User notified via SnackBar
   - Previous data unchanged

5. **Profile Update Failures**
   - Exception thrown with descriptive message
   - Transaction-like behavior (all-or-nothing)

## Platform Support

- ✅ Android
- ✅ iOS
- ✅ Windows
- ✅ macOS
- ✅ Linux
- ✅ Web (via SharedPreferences - future enhancement)

## Dependencies Used

- `image_picker: ^1.2.0` - Image selection from gallery
- `path_provider: ^2.1.3` - Access to documents directory
- `dart:io` - File operations
- `dart:convert` - JSON encoding/decoding

All dependencies already in `pubspec.yaml`

## Testing

### Manual Testing Steps

1. **First Login Test**
   - Start app
   - Login with email `test@example.com`
   - Verify username is set to `test` automatically

2. **Edit Username Test**
   - Go to Settings
   - Click edit icon
   - Change username to `newname`
   - Verify change persists after app restart

3. **Add Profile Picture Test**
   - Go to Settings
   - Click avatar
   - Select "Add Image"
   - Choose image from gallery
   - Verify image displays in avatar
   - Close and reopen app
   - Verify image persists

4. **Change Profile Picture Test**
   - From existing profile picture
   - Click avatar
   - Select "Edit Image"
   - Choose new image
   - Verify old image replaced

5. **Delete Profile Picture Test**
   - With existing image
   - Click avatar
   - Select "Delete Image"
   - Verify image removed and default avatar shows
   - Verify change persists after restart

## Troubleshooting

### Profile image not showing
- Check that image file exists in documents/profile_images/
- Verify JSON contains valid path
- Try deleting and re-adding image

### Changes not persisting
- Ensure app has document write permissions
- Check device storage is not full
- Try clearing app cache and logging in again

### Image picker not working
- Ensure app has camera/gallery permissions
- Try restarting app
- Check that valid image format (jpg, png)

## Future Enhancements

- [ ] Profile picture cropping UI
- [ ] Image compression
- [ ] Cloud backup integration
- [ ] Multi-profile support
- [ ] Theme/appearance preferences
- [ ] Biometric profile unlock
- [ ] Profile export/import

## Code Organization

```
lib/
├── services/
│   ├── user_service.dart (NEW)
│   ├── json_file_storage_service.dart
│   └── local_storage_service.dart
├── widgets/
│   ├── profile_bar.dart (MODIFIED)
│   └── ...
├── screens/
│   ├── login.dart (MODIFIED)
│   ├── settings.dart (MODIFIED)
│   ├── main_screen.dart
│   └── ...
└── main.dart (MODIFIED)
```

## Summary

The user profile management system is now fully functional and integrated into all relevant screens. Users can:
- Manage their username
- Upload and change profile pictures
- Have all changes persist across sessions

The implementation uses a simple JSON file for storage, making it easy to understand and maintain, while providing proper error handling and a smooth user experience.
