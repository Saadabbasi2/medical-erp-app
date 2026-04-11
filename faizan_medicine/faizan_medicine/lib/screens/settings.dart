import 'package:flutter/material.dart';
import 'about.dart';
import 'logout.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  void _showAppSettingsDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          title: const Text(
            'App Settings',
            style: TextStyle(color: Colors.black),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.dark_mode, color: Colors.black87),
                  title: const Text(
                    'Dark Mode',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: Switch(
                    value: true,
                    onChanged: (value) {},
                    activeThumbColor: Colors.black,
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.language, color: Colors.black87),
                  title: const Text(
                    'Language',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Text('English', style: TextStyle(color: Colors.black54)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close', style: TextStyle(color: Colors.black)),
            ),
          ],
        );
      },
    );
  }

  void _showSecurityDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          title: const Text(
            'Security Settings',
            style: TextStyle(color: Colors.black),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.lock, color: Colors.redAccent),
                  title: const Text(
                    'Change Password',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, color: Colors.black54),
                  onTap: () {
                    Navigator.of(context).pop();
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.fingerprint, color: Colors.redAccent),
                  title: const Text(
                    'Biometric Authentication',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: Switch(
                    value: false,
                    onChanged: (value) {},
                    activeThumbColor: Colors.redAccent,
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.timer, color: Colors.redAccent),
                  title: const Text(
                    'Auto Logout',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Text('30 min', style: TextStyle(color: Colors.black54)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close', style: TextStyle(color: Colors.black)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Settings', style: TextStyle(color: Colors.black)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  leading: const Icon(Icons.settings, color: Colors.black87),
                  title: const Text(
                    'App Settings',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, color: Colors.black54),
                  onTap: () => _showAppSettingsDialog(context),
                ),
                const Divider(color: Colors.black12),
                ListTile(
                  leading: const Icon(Icons.security, color: Colors.redAccent),
                  title: const Text(
                    'Security',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, color: Colors.black54),
                  onTap: () => _showSecurityDialog(context),
                ),
                const Divider(color: Colors.black12),
                ListTile(
                  leading: const Icon(Icons.info_outline, color: Colors.lightGreen),
                  title: const Text(
                    'About',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, color: Colors.black54),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const AboutScreen()),
                  ),
                ),
                const Divider(color: Colors.black12),
                ListTile(
                  leading: const Icon(Icons.logout, color: Colors.red),
                  title: const Text(
                    'Logout',
                    style: TextStyle(color: Colors.black),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, color: Colors.black54),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const LogoutScreen()),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
