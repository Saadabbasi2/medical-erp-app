import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_storage_service.dart';
import 'history.dart';
import 'reports.dart';
import 'settings.dart';

class CustomersScreen extends StatefulWidget {
  final String userEmail;

  const CustomersScreen({super.key, required this.userEmail});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  int _selectedIndex = 0;
  List<Map<String, dynamic>> _customers = [];
  List<Map<String, dynamic>> _items = [];
  // No instance needed for static methods

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  /// Loads both customers and items data from JSON file storage.
  Future<void> _loadData() async {
    try {
      _customers = await ApiStorageService.loadCustomers();
      _items = await ApiStorageService.loadItems();
      setState(() {});
    } catch (e) {
      print('Error loading data: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Failed to load data')));
      }
    }
  }

  /// Saves the current customers data to JSON file storage.
  Future<void> _saveCustomers() async {
    try {
      await ApiStorageService.saveCustomers(_customers);
    } catch (e) {
      print('Error saving customers: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save customers data')),
        );
      }
    }
  }

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

  void _addCustomer() {
    _showAddCustomerDialog();
  }

  void _showAddCustomerDialog() {
    final outerSetState = setState;
    final TextEditingController nameController = TextEditingController();
    final TextEditingController contactController = TextEditingController();
    final TextEditingController locationController = TextEditingController();
    List<String> selectedItems = [];

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, innerSetState) {
            return Dialog(
              backgroundColor: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: SizedBox(
                width: MediaQuery.of(context).size.width * 0.9,
                height: MediaQuery.of(context).size.height * 0.8,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'Add New Customer',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            TextField(
                              controller: nameController,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(
                                labelText: 'Customer Name',
                                labelStyle: TextStyle(color: Colors.white70),
                                enabledBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(color: Colors.white70),
                                ),
                                focusedBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(
                                    color: Colors.blueAccent,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: contactController,
                              style: const TextStyle(color: Colors.white),
                              keyboardType: TextInputType.phone,
                              decoration: const InputDecoration(
                                labelText: 'Contact Number',
                                labelStyle: TextStyle(color: Colors.white70),
                                enabledBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(color: Colors.white70),
                                ),
                                focusedBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(
                                    color: Colors.blueAccent,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: locationController,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(
                                labelText: 'Location',
                                labelStyle: TextStyle(color: Colors.white70),
                                enabledBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(color: Colors.white70),
                                ),
                                focusedBorder: UnderlineInputBorder(
                                  borderSide: BorderSide(
                                    color: Colors.blueAccent,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Select Required Items:',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _items.length,
                              itemBuilder: (context, index) {
                                final item = _items[index];
                                final isSelected = selectedItems.contains(
                                  item['name'],
                                );
                                return CheckboxListTile(
                                  title: Text(
                                    '${item['name']} - ${item['price']}',
                                    style: const TextStyle(color: Colors.white),
                                  ),
                                  subtitle: Text(
                                    'Category: ${item['category']}',
                                    style: const TextStyle(
                                      color: Colors.white54,
                                    ),
                                  ),
                                  value: isSelected,
                                  onChanged: (bool? value) {
                                    innerSetState(() {
                                      if (value == true) {
                                        selectedItems.add(item['name']!);
                                      } else {
                                        selectedItems.remove(item['name']);
                                      }
                                    });
                                  },
                                  activeColor: Colors.blueAccent,
                                  checkColor: Colors.white,
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(color: Colors.white70),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: () async {
                              final name = nameController.text.trim();
                              final contact = contactController.text.trim();
                              final location = locationController.text.trim();
                              if (name.isNotEmpty &&
                                  contact.isNotEmpty &&
                                  location.isNotEmpty) {
                                outerSetState(() {
                                  _customers.add({
                                    'name': name,
                                    'contact': contact,
                                    'location': location,
                                    'requiredItems': selectedItems.join(', '),
                                  });
                                });
                                await _saveCustomers(); // Save to user's file
                                Navigator.of(context).pop();
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blueAccent,
                            ),
                            child: const Text(
                              'Add',
                              style: TextStyle(color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _deleteCustomer(int index) async {
    setState(() {
      _customers.removeAt(index);
    });
    await _saveCustomers(); // Save changes to user's file
  }

  void _makeCall(String phoneNumber) async {
    final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not launch phone app')),
        );
      }
    }
  }

  void _showCustomerDetails(int index) {
    final customer = _customers[index];
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: const Color(0xFF161B22),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: SizedBox(
            width: MediaQuery.of(context).size.width * 0.9,
            height: MediaQuery.of(context).size.height * 0.6,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Customer Details',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Name: ${customer['name']}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Contact: ${customer['contact']}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Location: ${customer['location']}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (customer['requiredItems'] != null &&
                            customer['requiredItems']!.isNotEmpty)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Required Items:',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Builder(
                                builder: (context) {
                                  final itemNames = customer['requiredItems']!
                                      .split(', ');
                                  final itemDetails = itemNames
                                      .map((name) {
                                        final item = _items.firstWhere(
                                          (i) => i['name'] == name.trim(),
                                          orElse: () => {},
                                        );
                                        return item.isNotEmpty
                                            ? '$name - ${item['price']}'
                                            : name;
                                      })
                                      .join(', ');
                                  return Text(
                                    itemDetails,
                                    style: const TextStyle(
                                      color: Colors.blueAccent,
                                      fontSize: 14,
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text(
                          'Close',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
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
          'Customers',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add, color: Colors.white),
            onPressed: _addCustomer,
          ),
        ],
      ),
      body: _customers.isEmpty
          ? const Center(
              child: Text(
                'No customers added yet.\nTap the + button to add your first customer.',
                style: TextStyle(color: Colors.white70, fontSize: 16),
                textAlign: TextAlign.center,
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _customers.length,
              itemBuilder: (context, index) {
                return Card(
                  color: const Color(0xFF161B22),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    onTap: () => _showCustomerDetails(index),
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFF1F6FEB),
                      child: Icon(Icons.person, color: Colors.white),
                    ),
                    title: Text(
                      _customers[index]['name'] ?? '',
                      style: const TextStyle(color: Colors.white),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Contact: ${_customers[index]['contact'] ?? ''} | Location: ${_customers[index]['location'] ?? ''}',
                          style: const TextStyle(color: Colors.white54),
                        ),
                        if (_customers[index]['requiredItems'] != null &&
                            _customers[index]['requiredItems']!.isNotEmpty)
                          Text(
                            'Required Items: ${_customers[index]['requiredItems']}',
                            style: const TextStyle(
                              color: Colors.blueAccent,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(
                            Icons.phone,
                            color: Colors.blueAccent,
                          ),
                          onPressed: () =>
                              _makeCall(_customers[index]['contact'] ?? ''),
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.delete,
                            color: Colors.redAccent,
                          ),
                          onPressed: () => _deleteCustomer(index),
                        ),
                      ],
                    ),
                  ),
                );
              },
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
