import 'package:flutter/material.dart';
import 'reports.dart';
import 'history.dart';
import 'settings.dart';
import 'logout.dart';

class ControlPanelScreen extends StatefulWidget {
  const ControlPanelScreen({super.key});

  @override
  State<ControlPanelScreen> createState() => _ControlPanelScreenState();
}

class _ControlPanelScreenState extends State<ControlPanelScreen> {
  int _selectedIndex = 0;

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
    if (index == 0) {
      Navigator.pop(context);
    } else if (index == 1) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const ReportsScreen()),
      );
    } else if (index == 2) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const HistoryScreen()),
      );
    } else if (index == 3) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const SettingsScreen()),
      );
    }
  }

  void _showAppSettingsDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF161B22),
          title: const Text(
            'App Settings',
            style: TextStyle(color: Colors.white),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.dark_mode, color: Colors.blueAccent),
                title: const Text(
                  'Dark Mode',
                  style: TextStyle(color: Colors.white),
                ),
                trailing: Switch(
                  value: true,
                  onChanged: (value) {},
                  activeThumbColor: Colors.blueAccent,
                ),
              ),
              ListTile(
                leading: const Icon(Icons.language, color: Colors.blueAccent),
                title: const Text(
                  'Language',
                  style: TextStyle(color: Colors.white),
                ),
                trailing: const Text(
                  'English',
                  style: TextStyle(color: Colors.white70),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text(
                'Close',
                style: TextStyle(color: Colors.blueAccent),
              ),
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
          backgroundColor: const Color(0xFF161B22),
          title: const Text(
            'Security Settings',
            style: TextStyle(color: Colors.white),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.lock, color: Colors.redAccent),
                title: const Text(
                  'Change Password',
                  style: TextStyle(color: Colors.white),
                ),
                trailing: const Icon(
                  Icons.arrow_forward_ios,
                  color: Colors.white70,
                ),
                onTap: () {
                  Navigator.of(context).pop();
                  // Navigate to change password screen
                },
              ),
              ListTile(
                leading: const Icon(Icons.fingerprint, color: Colors.redAccent),
                title: const Text(
                  'Biometric Authentication',
                  style: TextStyle(color: Colors.white),
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
                  style: TextStyle(color: Colors.white),
                ),
                trailing: const Text(
                  '30 min',
                  style: TextStyle(color: Colors.white70),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text(
                'Close',
                style: TextStyle(color: Colors.redAccent),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: const TextStyle(color: Colors.white),
        title: const Text(
          'Settings',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.settings, color: Colors.blueAccent),
              title: const Text(
                'App Settings',
                style: TextStyle(color: Colors.white),
              ),
              trailing: const Icon(
                Icons.arrow_forward_ios,
                color: Colors.white70,
              ),
              onTap: () {
                _showAppSettingsDialog(context);
              },
            ),
            const Divider(color: Colors.white10),
            ListTile(
              leading: const Icon(Icons.security, color: Colors.redAccent),
              title: const Text(
                'Security',
                style: TextStyle(color: Colors.white),
              ),
              trailing: const Icon(
                Icons.arrow_forward_ios,
                color: Colors.white70,
              ),
              onTap: () {
                _showSecurityDialog(context);
              },
            ),
            const Divider(color: Colors.white10),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.redAccent),
              title: const Text(
                'Logout',
                style: TextStyle(color: Colors.white),
              ),
              trailing: const Icon(
                Icons.arrow_forward_ios,
                color: Colors.white70,
              ),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const LogoutScreen()),
                );
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF161B22),
        selectedItemColor: Colors.blueAccent,
        unselectedItemColor: Colors.white70,
        type: BottomNavigationBarType.fixed,
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: "Home"),
          BottomNavigationBarItem(
            icon: Icon(Icons.bar_chart),
            label: "Reports",
          ),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: "History"),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: "Settings",
          ),
        ],
      ),
    );
  }
}
