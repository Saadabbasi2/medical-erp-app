import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

import '../utils/documents_helper.dart';
import '../utils/json_sanitizer.dart';

class UserDataService {
  static const _kEmail = 'fm_salesman_user_email';
  static const _kErpName = 'fm_salesman_erp_name';

  static Map<String, dynamic> _mapFromEmailAndName(
    String email,
    String salesmanName,
  ) {
    final nameTrim = salesmanName.trim();
    String username = 'User';
    if (email.isNotEmpty && email.contains('@')) {
      username = email.split('@')[0];
    }
    return {
      'username': username,
      'email': email,
      'salesmanName': nameTrim,
    };
  }

  /// Loads user data (SharedPreferences first — reliable on web — then user.json).
  static Future<Map<String, dynamic>> loadUserData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pe = prefs.getString(_kEmail);
      final pn = prefs.getString(_kErpName);
      if (pe != null && pe.isNotEmpty) {
        return _mapFromEmailAndName(pe, pn ?? '');
      }
    } catch (e) {
      print('Error loading user prefs: $e');
    }

    try {
      final dir = await getDocumentsDirectorySafe();
      final file = File('${dir.path}/user.json');
      if (!await file.exists()) {
        return {'username': 'User', 'email': '', 'salesmanName': ''};
      }
      final contents = await file.readAsString();
      if (contents.trim().isEmpty) {
        return {'username': 'User', 'email': '', 'salesmanName': ''};
      }
      final data = json.decode(contents) as Map<String, dynamic>;
      final email = data['email'] ?? '';
      final salesmanName = (data['salesmanName'] ?? '').toString().trim();

      String username = 'User';
      if (email.isNotEmpty && email.contains('@')) {
        username = email.split('@')[0];
      }

      return {
        'username': username,
        'email': email,
        'salesmanName': salesmanName,
      };
    } catch (e) {
      print('Error loading user data: $e');
      return {'username': 'User', 'email': '', 'salesmanName': ''};
    }
  }

  /// Saves user email and optional ERP salesman display [name] (from login API).
  static Future<void> saveUserData(
    String username,
    String email, {
    String? salesmanName,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kEmail, email);
      final sn = salesmanName?.trim();
      if (sn != null && sn.isNotEmpty) {
        await prefs.setString(_kErpName, sn);
      } else {
        await prefs.remove(_kErpName);
      }

      final dir = await getDocumentsDirectorySafe();
      final file = File('${dir.path}/user.json');
      final data = <String, dynamic>{
        'email': email,
        if (salesmanName != null && salesmanName.trim().isNotEmpty)
          'salesmanName': salesmanName.trim(),
      };
      final jsonString = JsonSanitizer.safeEncode(data);
      await file.writeAsString(jsonString);

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
