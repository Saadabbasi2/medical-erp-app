import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'main_screen.dart';
import '../services/user_data_service.dart';
import '../services/api_storage_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;

  static const String _apiBase = 'http://84.247.169.194';

  void _login() async {
    final currentContext = context;
    String email = _emailController.text.trim();
    String password = _passwordController.text;

    // Basic validation
    if (email.isEmpty || !email.contains('@')) {
      ScaffoldMessenger.of(currentContext).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email address')),
      );
      return;
    }

    if (password.isEmpty || password.length < 6) {
      ScaffoldMessenger.of(currentContext).showSnackBar(
        const SnackBar(
          content: Text('Password must be at least 6 characters long'),
        ),
      );
      return;
    }

    FocusScope.of(currentContext).unfocus();
    setState(() => _isLoading = true);

    // Extract name before @
    String userName = email.split('@')[0];

    try {
      final response = await http.post(
        Uri.parse('$_apiBase/api/salesman/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'loginID': email, 'password': password}),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (data['success'] == true) {
          // Store salesman ID for API calls
          final userData = data['user'] as Map<String, dynamic>?;
          if (userData != null && userData['id'] != null) {
            ApiStorageService.setSalesmanId(userData['id'].toString());
          }
          
          try {
            await UserDataService.saveUserData(userName, email);
          } catch (e) {
            debugPrint('Error saving user data: $e');
          }

          if (!mounted) return;
          Navigator.pushReplacement(
            currentContext,
            MaterialPageRoute(
              builder: (context) =>
                  MainScreen(userName: userName, userEmail: email),
            ),
          );
          return;
        }
      }

      String errorMessage = 'Unable to login. Please check your credentials.';
      try {
        final body = jsonDecode(response.body);
        if (body is Map && body['error'] is String) {
          errorMessage = body['error'] as String;
        }
      } catch (_) {}

      if (mounted) {
        ScaffoldMessenger.of(currentContext).showSnackBar(
          SnackBar(content: Text(errorMessage)),
        );
      }
    } on http.ClientException catch (e) {
      debugPrint('HTTP error: $e');
      ScaffoldMessenger.of(currentContext).showSnackBar(
        const SnackBar(
          content: Text('Network error. Please try again.'),
        ),
      );
    } on Exception catch (e) {
      debugPrint('Login error: $e');
      ScaffoldMessenger.of(currentContext).showSnackBar(
        const SnackBar(
          content: Text('Login failed. Please try again later.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              children: [
                const Text(
                  'Welcome Back',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 30),
                _inputField('Email', Icons.email, controller: _emailController),
                const SizedBox(height: 20),
                _inputField(
                  'Password',
                  Icons.lock,
                  controller: _passwordController,
                  isPassword: true,
                ),
                const SizedBox(height: 30),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    side: const BorderSide(color: Colors.black12),
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _isLoading ? null : _login,
                  child: _isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.black),
                          ),
                        )
                      : const Text(
                          'Login',
                          style: TextStyle(fontSize: 16, color: Colors.black),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _inputField(
    String label,
    IconData icon, {
    bool isPassword = false,
    required TextEditingController controller,
  }) {
    return TextField(
      controller: controller,
      obscureText: isPassword,
      style: const TextStyle(color: Colors.black),
      decoration: InputDecoration(
        filled: true,
        fillColor: Colors.white,
        prefixIcon: Icon(icon, color: Colors.black54),
        labelText: label,
        labelStyle: const TextStyle(color: Colors.black54),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black12),
        ),
      ),
    );
  }
}
