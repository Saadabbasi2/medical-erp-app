import 'dart:convert';
import 'dart:io';

import '../utils/documents_helper.dart';
import '../utils/json_sanitizer.dart';

class UserDataService {
  /// Loads user data from storage.
  /// Returns username (extracted from email) and email from user.json
  static Future<Map<String, dynamic>> loadUserData() async {
    try {
      final dir = await getDocumentsDirectorySafe();
      final file = File('${dir.path}/user.json');
      if (!await file.exists()) {
        // Return default data if file doesn't exist
        return {'username': 'User', 'email': ''};
      }
      final contents = await file.readAsString();
      if (contents.trim().isEmpty) {
        return {'username': 'User', 'email': ''};
      }
      final data = json.decode(contents) as Map<String, dynamic>;
      final email = data['email'] ?? '';

      // Extract username from email (part before @)
      String username = 'User';
      if (email.isNotEmpty && email.contains('@')) {
        username = email.split('@')[0];
      }

      return {'username': username, 'email': email};
    } catch (e) {
      print('Error loading user data: $e');
      return {'username': 'User', 'email': ''};
    }
  }

  /// Saves user email to storage.
  /// Username will be derived from email by extracting the part before '@'
  static Future<void> saveUserData(String username, String email) async {
    try {
      final dir = await getDocumentsDirectorySafe();
      final file = File('${dir.path}/user.json');
      // Only store email; username is derived from email
      final data = {'email': email};
      // Use sanitized JSON encoding to prevent serialization errors
      final jsonString = JsonSanitizer.safeEncode(data);
      await file.writeAsString(jsonString);

      // Confirm file was created successfully
      if (await file.exists()) {
        print('User data saved successfully to: ${file.path}');
      } else {
        throw Exception('File was not created after save operation');
      }
    } catch (e) {
      print('Error saving user data: $e');
      throw Exception('Failed to save user data: $e');
    }
  }
}
