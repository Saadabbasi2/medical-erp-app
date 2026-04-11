import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/json_sanitizer.dart';

class LocalStorageService {
  static String _sanitizeEmail(String email) {
    return email
        .replaceAll('@', '_at_')
        .replaceAll('.', '_dot_')
        .replaceAll('/', '_slash_')
        .replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
  }

  static String _getUserDataKey(String email) {
    final sanitizedEmail = _sanitizeEmail(email);
    return 'user_$sanitizedEmail';
  }

  static Future<void> saveUserData(String email, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getUserDataKey(email);
      final jsonString = JsonSanitizer.safeEncode(data);
      await prefs.setString(key, jsonString);
      print('✅ Data saved successfully for user: $email');
    } catch (e) {
      print('❌ Error saving data for user $email: $e');
      throw Exception('Failed to save user data');
    }
  }

  static Future<Map<String, dynamic>> loadUserData(String email) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getUserDataKey(email);
      final jsonString = prefs.getString(key);

      if (jsonString != null) {
        final data = json.decode(jsonString) as Map<String, dynamic>;
        print('✅ Data loaded successfully for user: $email');
        return data;
      } else {
        print('⚠️ No data found for user: $email, returning default');
        return {'items': [], 'customers': []};
      }
    } catch (e) {
      print('❌ Error loading data for user $email: $e');
      return {'items': [], 'customers': []};
    }
  }

  static Future<void> clearUserData(String email) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getUserDataKey(email);
      await prefs.remove(key);
      print('✅ Data cleared successfully for user: $email');
    } catch (e) {
      print('❌ Error clearing data for user $email: $e');
      throw Exception('Failed to clear user data');
    }
  }

  static Future<bool> userDataExists(String email) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getUserDataKey(email);
      return prefs.containsKey(key);
    } catch (e) {
      return false;
    }
  }
}
