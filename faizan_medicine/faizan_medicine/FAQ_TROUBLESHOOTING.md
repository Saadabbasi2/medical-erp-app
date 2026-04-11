# FAQ & Troubleshooting

## Frequently Asked Questions

### Q: Where are my profile pictures stored?
**A:** Profile pictures are stored in the app's documents directory under `profile_images/`. This is platform-specific:
- **Android**: `/data/data/com.example.faizan_medicine/files/profile_images/`
- **iOS**: `Documents/profile_images/`
- **Windows**: `%USERPROFILE%\AppData\Local\com.example.faizan_medicine\profile_images\`

### Q: Will my profile data sync across devices?
**A:** Currently, profile data is stored locally on each device. Cloud sync is a planned future feature. To use the same profile on multiple devices, you'll need to re-upload images after logging in on each device.

### Q: Can I have multiple profiles?
**A:** Currently, the app supports one profile per installation. Multiple profiles are a planned feature. To switch profiles, you would log out and create a new account.

### Q: What image formats are supported?
**A:** The image picker supports:
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif) on Android
- WebP on supported platforms

### Q: Is there a maximum image size?
**A:** Images are optimized to 800x800 pixels and 80% quality. Original image size doesn't matter - they'll be optimized before saving.

### Q: Can I undo profile changes?
**A:** Currently, undo is not implemented. Changes are saved immediately. To revert:
- **Username**: Re-edit to previous name
- **Profile picture**: Replace with old image or delete and re-upload

### Q: What happens if I uninstall and reinstall the app?
**A:** Profile data is stored in the app's documents directory. Uninstalling typically deletes app data, so you'll start fresh. To preserve data, backup the documents directory before uninstalling.

### Q: Can I backup my profile?
**A:** Automated backup is planned. For manual backup:
- Copy `user.json` and `profile_images/` from app documents directory
- Restore by copying them back

### Q: Is profile data encrypted?
**A:** Currently, profile data is stored as plain JSON. Encryption is a planned security enhancement.

### Q: Why is my image appearing blurry?
**A:** The original image quality is preserved. If appearing blurry:
- Delete and re-upload with a high-quality image
- Check that the source image isn't already low quality

---

## Troubleshooting Guide

### Issue: App crashes when selecting image

**Possible Causes:**
1. Insufficient app permissions
2. File system error
3. Image picker not initialized

**Solutions:**
1. **Check Permissions**
   - Android: Go to Settings → Apps → Faizan Medicine → Permissions → Grant gallery/camera access
   - iOS: Settings → Faizan Medicine → Photos → Allow access

2. **Restart App**
   - Close app completely
   - Reopen and try again

3. **Clear Cache**
   - Android: Settings → Apps → Faizan Medicine → Storage → Clear Cache
   - iOS: Usually not needed (system manages)

4. **Reinstall App**
   - Last resort: Delete and reinstall app

---

### Issue: Image not displaying after upload

**Possible Causes:**
1. Image file deleted externally
2. Storage permission revoked
3. Corrupted image file

**Solutions:**
1. **Delete and Re-upload**
   - Click avatar → "Delete Image" → "Add Image"
   - Select image again

2. **Check Permissions**
   - Ensure app has storage write permissions

3. **Try Different Image**
   - Use a different image to verify
   - If original works: it may be corrupted

4. **Restart App**
   - Close and reopen app

---

### Issue: Username changes not saving

**Possible Causes:**
1. Insufficient storage space
2. File permission error
3. Concurrent save operation

**Solutions:**
1. **Free Up Storage**
   - Delete unnecessary files/photos
   - Delete old profile images
   - Reinstall app

2. **Check Permissions**
   - Verify app has write permissions to documents

3. **Retry**
   - Close app
   - Reopen
   - Try editing username again

4. **Check user.json**
   - File: `Documents/user.json`
   - Verify file isn't corrupted

---

### Issue: Profile shows "User" after restart

**Possible Causes:**
1. user.json file missing/corrupted
2. First time running after update
3. App data cleared

**Solutions:**
1. **Re-edit Username**
   - Go to Settings
   - Click edit icon
   - Enter desired username and save

2. **Logout and Login**
   - Logout
   - Login again
   - Username will be re-initialized from email

3. **Restart App**
   - Close app completely
   - Reopen (gives time for initialization)

---

### Issue: "Failed to save image" error

**Possible Causes:**
1. Insufficient storage space
2. Storage permission revoked
3. File system error
4. Image corrupted

**Solutions:**
1. **Free Up Space**
   - Device is likely out of storage
   - Delete large files/videos
   - Verify at least 50MB free

2. **Restore Permissions**
   - Check app storage permissions
   - Reinstall if permissions corrupted

3. **Try Different Image**
   - Attempt with different image
   - Verify source image is valid

4. **Restart Device**
   - Restart phone
   - Try again

---

### Issue: App runs out of storage

**Possible Causes:**
1. Multiple large profile images stored
2. Profile images not being cleaned up
3. Device storage full

**Solutions:**
1. **Delete Old Profile Images**
   - Edit profile image multiple times
   - Each change deletes old image
   - Only latest image kept

2. **Free Device Storage**
   - Delete unnecessary apps
   - Clear browser cache
   - Delete old messages/media

3. **Check Image Sizes**
   - Profile images optimized to ~100-150KB each
   - If larger, file system issue possible

---

### Issue: Can't access gallery/camera

**Possible Causes:**
1. Permissions not granted
2. Gallery/Camera app issue
3. Device restriction

**Solutions:**
1. **Grant Permissions**
   - Settings → Apps → Faizan Medicine → Permissions
   - Enable "Photos/Gallery" (Android)
   - Enable "Photos" (iOS)
   - Enable "Camera" if needed

2. **Restart Device**
   - Sometimes permissions need device restart

3. **Check Device Settings**
   - Parental controls may block gallery
   - Check security settings

4. **Use Different App**
   - If system gallery broken
   - Try alternative gallery app

---

## Common Error Messages

| Message | Meaning | Solution |
|---------|---------|----------|
| "Error loading profile" | user.json not readable | Restart app |
| "Failed to save image" | Storage issue | Free up space |
| "Error selecting image" | Picker issue | Restart app |
| "Error updating profile" | JSON write failed | Check permissions |
| "Error deleting image" | File not deletable | Retry |

---

## Performance Tips

### Improve App Speed
1. **Delete old profile images**
   - Each change stores old image until delete
   - Regularly clean up if many changes

2. **Keep app updated**
   - Updates include performance improvements
   - New versions optimized

3. **Restart app periodically**
   - Clears memory cache
   - Refreshes connections

4. **Check device storage**
   - Low storage = slower performance
   - Keep at least 100MB free

---

## Security Considerations

### Protect Your Profile
1. **Device Lock**
   - Use PIN/fingerprint/face unlock
   - Prevents unauthorized access

2. **Backup Data**
   - Regularly backup profile
   - Store backup securely

3. **Use Strong Passwords**
   - Login with strong password
   - Helps prevent unauthorized access

### Data Privacy
- Profile data stored locally, not cloud
- Only you can access on your device
- Data removed if app uninstalled

---

## Getting Help

### Where to Report Issues
1. **In-App Settings**
   - About screen may have feedback option

2. **Contact Developer**
   - Email support if provided
   - Include screenshots and steps to reproduce

3. **Check Documentation**
   - PROFILE_SETUP_GUIDE.md - Complete guide
   - CHANGES_DETAILED.md - Technical details
   - VERIFICATION_REPORT.md - Feature checklist

---

## Advanced Troubleshooting

### Check File System

**View user.json contents:**
1. Connect device to computer
2. Enable USB debugging (Android)
3. Use file explorer to navigate to app documents
4. Open user.json with text editor
5. Verify JSON format is valid

**Check image directory:**
1. Same as above
2. Navigate to `profile_images/` directory
3. Verify images exist
4. Check image file sizes (should be ~100-200KB each)

### Reset Profile Data

**Clear profile (returns to defaults):**
1. File manager → App documents
2. Delete `user.json`
3. Restart app
4. Profile returns to "User" with no image

**Clear all profile data:**
1. Delete both `user.json` and `profile_images/` directory
2. Restart app
3. App reinitializes with defaults

---

## Known Limitations

### Current Version
- ⚠️ Single profile per installation (multi-profile planned)
- ⚠️ No cloud sync (planned for future)
- ⚠️ No image cropping (planned)
- ⚠️ No compression options (auto-optimized)

### Platform Specific
- ⚠️ Web platform not yet fully supported
- ✅ All mobile platforms fully supported

---

## Still Having Issues?

1. **Check this FAQ** - Your issue likely covered above
2. **Review documentation** - PROFILE_SETUP_GUIDE.md has comprehensive info
3. **Restart device** - Fixes most issues
4. **Reinstall app** - Last resort if corruption suspected
5. **Contact support** - If issue persists

---

## Version History

### v1.0 (Current)
- ✅ Username editing
- ✅ Profile image upload/edit/delete
- ✅ Persistent storage via JSON
- ✅ Error handling and validation
- ✅ Cross-device display (non-synced)

### v1.1 (Planned)
- [ ] Image cropping UI
- [ ] Cloud backup option
- [ ] Multi-device sync
- [ ] Profile history

---

**Last Updated:** November 11, 2025
**Status:** Current Version
**Support:** Check documentation first, then contact developer
