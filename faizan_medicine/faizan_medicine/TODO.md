# TODO: Fix Bottom Navigation Bar White Screen Issue

## Completed Tasks
- [x] Analyzed the bottom navigation implementation in main_screen.dart
- [x] Identified the issue: Using Navigator.pushReplacement instead of Navigator.push
- [x] Fixed the navigation by changing pushReplacement to push with .then() callbacks to reset selected index
- [x] Verified that ReportsScreen, HistoryScreen, and SettingsScreen have back buttons

## Summary
The issue was caused by using `Navigator.pushReplacement` in the `_onItemTapped` method, which replaced the main screen in the navigation stack. When users tapped back from the other screens, there was no main screen to return to, resulting in a white screen and stuck app.

The fix involved:
- Changing `pushReplacement` to `push` to keep the main screen in the stack
- Adding `.then()` callbacks to reset `_selectedIndex` to 0 when returning to the main screen
- This ensures proper navigation flow and prevents the app from getting stuck
