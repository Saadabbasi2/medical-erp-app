import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:pdf/widgets.dart' as pw;

import '../services/api_storage_service.dart';
import '../utils/format_utils.dart';
import '../utils/pdf_saver.dart';
import 'history.dart';
import 'reports.dart';
import 'settings.dart';

class SaleOrderScreen extends StatefulWidget {
  const SaleOrderScreen({super.key});

  @override
  State<SaleOrderScreen> createState() => _SaleOrderScreenState();
}

class _SaleOrderScreenState extends State<SaleOrderScreen> {
  int _selectedIndex = 0;
  List<Map<String, dynamic>> _orders = [];
  List<Map<String, dynamic>> _customers = [];

  @override
  void initState() {
    super.initState();
    _loadCustomers();
    _loadOrders();
  }

  Future<void> _loadCustomers() async {
    try {
      final customers = await ApiStorageService.loadCustomers();
      print('Loaded customers: $customers'); // Debug print
      if (customers.isEmpty) {
        print('Warning: No customers loaded from storage');
      }
      setState(() {
        _customers = customers;
      });
    } catch (e) {
      print('Error loading customers: $e');
      setState(() {
        _customers = [];
      });
    }
  }

  Future<void> _loadOrders() async {
    try {
      final orders = await ApiStorageService.loadSaleOrders();
      setState(() => _orders = orders);
    } catch (e) {
      print('Error loading sale orders: $e');
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

  Future<void> _generateAndOpenPDF(Map<String, dynamic> order) async {
    try {
      final pdf = pw.Document();
      final orderId = order['id'] ?? 'order';
      final customer = order['customer_name'] ?? '';
      final status = order['delivery_status'] ?? 'pending';
      final total = order['total'] ?? 0;
      final createdAt = order['created_at'] ?? '';
      final deliveryDate = order['delivery_date'] ?? '';

      pdf.addPage(
        pw.Page(
          build: (pw.Context context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Sale Order Details',
                style: pw.TextStyle(
                  fontSize: 24,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 12),
              pw.Text(
                'Order ID: $orderId',
                style: const pw.TextStyle(fontSize: 16),
              ),
              pw.Text(
                'Customer: $customer',
                style: const pw.TextStyle(fontSize: 16),
              ),
              pw.Text(
                'Status: $status',
                style: const pw.TextStyle(fontSize: 16),
              ),
              pw.Text(
                'Total Amount: ${formatPKR(total)}',
                style: const pw.TextStyle(fontSize: 16),
              ),
              pw.Text(
                'Created: $createdAt',
                style: const pw.TextStyle(fontSize: 12),
              ),
              if (deliveryDate.isNotEmpty)
                pw.Text(
                  'Delivery Date: $deliveryDate',
                  style: const pw.TextStyle(fontSize: 12),
                ),
              pw.SizedBox(height: 16),
              pw.Text(
                'Items:',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              if ((order['items'] as List<dynamic>?)?.isNotEmpty ?? false)
                ...((order['items'] as List).map(
                  (it) => pw.Bullet(
                    text:
                        '${it['name']} - Qty: ${it['quantity']} - Price: ${formatPKR(it['price'])}',
                  ),
                ))
              else
                pw.Text(
                  'No item details',
                  style: const pw.TextStyle(fontSize: 12),
                ),
            ],
          ),
        ),
      );

      final bytes = await pdf.save();
      final filename = '$orderId.pdf';
      try {
        await savePdf(bytes, filename);
      } catch (e) {
        print('Failed to save or open PDF: $e');
      }
    } catch (e) {
      print('Error generating PDF: $e');
    }
  }

  Future<void> _showCreateOrderDialog() async {
    String? selectedCustomerId;
    double total = 0.0;
    final totalController = TextEditingController();

    // Debug prints for troubleshooting
    print('Opening create order dialog');
    print('Total customers loaded: ${_customers.length}');
    for (var c in _customers) {
      print('Customer: id=${c['id']}, name=${c['name']}');
    }

    // Find first valid customer for initial selection
    if (_customers.isNotEmpty) {
      var validCustomers = _customers
          .where((c) => c['name'] != null && c['name'].toString().isNotEmpty)
          .toList();

      if (validCustomers.isNotEmpty) {
        var customer = validCustomers.first;
        var id = customer['id']?.toString();
        if (id == null || id.isEmpty) {
          id = 'AUTO-001'; // Consistent with dropdown generation
        }
        selectedCustomerId = id;
        print('Selected initial customer: ${customer['name']} ($id)');
      } else {
        print('No valid customers found for initial selection');
      }
    }

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            bool isCreateEnabled = false;

            // Print customers for debugging
            print('Customers available: ${_customers.length}');
            for (var c in _customers) {
              print('Customer: ${c['name']} (${c['id']})');
            }

            print('Building dropdown with ${_customers.length} customers');

            // Filter valid customers and build dropdown items
            final customerItems = <DropdownMenuItem<String>>[];
            int autoIdCounter = 1;
            for (final customer in _customers) {
              print('Processing customer: $customer'); // Debug each customer

              var id = customer['id']?.toString();
              final name = customer['name']?.toString();

              // If no ID exists, generate one (this is temporary for display only)
              if ((id == null || id.isEmpty) &&
                  name != null &&
                  name.isNotEmpty) {
                id = 'AUTO-${autoIdCounter.toString().padLeft(3, '0')}';
                autoIdCounter++;
              }

              if (name != null && name.isNotEmpty) {
                customerItems.add(
                  DropdownMenuItem<String>(
                    value: id,
                    child: Text(
                      name,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                );
              } else {
                print('Skipping customer with missing name: $customer');
              }
            }

            // Sort items by name for better UX
            customerItems.sort(
              (a, b) => ((a.child as Text).data ?? '').compareTo(
                (b.child as Text).data ?? '',
              ),
            );

            // If there are no valid customers, force selectedCustomerId to null so
            // we don't build a Dropdown with an invalid value. If there are valid customers
            // ensure selectedCustomerId is one of them.
            if (customerItems.isEmpty) {
              selectedCustomerId = null;
            } else if (selectedCustomerId == null ||
                !customerItems.any((mi) => mi.value == selectedCustomerId)) {
              // pick the first available value to avoid Dropdown assertion
              selectedCustomerId = customerItems.first.value;
            }

            void refreshEnabled() {
              final selected = selectedCustomerId;
              final parsed =
                  double.tryParse(totalController.text.trim()) ?? 0.0;
              setDialogState(() {
                isCreateEnabled = selected != null && parsed > 0;
                print(
                  'Create button enabled: $isCreateEnabled (selected=$selected, amount=$parsed)',
                );
              });
            }

            // Call refreshEnabled initially to set correct state
            refreshEnabled();

            // Make the dialog content scrollable and constrained so it won't overflow
            // the screen (which previously caused huge RenderFlex overflow when the
            // assertion UI ballooned). Use MediaQuery to set a reasonable max height.
            return AlertDialog(
              backgroundColor: const Color(0xFF161B22),
              title: const Text(
                'Create Sale Order',
                style: TextStyle(color: Colors.white),
              ),
              content: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(context).size.height * 0.6,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (customerItems.isEmpty)
                        const Text(
                          'No customers available. Please add a customer first.',
                          style: TextStyle(color: Colors.white70),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 8.0),
                          child: DropdownButtonFormField<String>(
                            initialValue: selectedCustomerId,
                            dropdownColor: const Color(0xFF161B22),
                            decoration: const InputDecoration(
                              labelText: 'Select Customer',
                              labelStyle: TextStyle(color: Colors.white70),
                              border: OutlineInputBorder(),
                              enabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.white30),
                              ),
                            ),
                            items: customerItems,
                            onChanged: (v) {
                              print('Selected customer changed to: $v');
                              selectedCustomerId = v;
                              refreshEnabled();
                            },
                            isExpanded: true, // Makes dropdown take full width
                            hint: const Text(
                              'Choose a customer',
                              style: TextStyle(color: Colors.white70),
                            ),
                          ),
                        ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: totalController,
                        onChanged: (_) => refreshEnabled(),
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        style: const TextStyle(color: Colors.white),
                        decoration: const InputDecoration(
                          labelText: 'Total Amount (PKR)',
                          labelStyle: TextStyle(color: Colors.white70),
                          hintText: 'Enter amount in Pakistani Rupees',
                          hintStyle: TextStyle(color: Colors.white30),
                          prefixText: 'Rs. ',
                          prefixStyle: TextStyle(color: Colors.white70),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
                ElevatedButton(
                  onPressed: isCreateEnabled
                      ? () async {
                          final selected = selectedCustomerId;
                          if (selected == null) return;
                          total =
                              double.tryParse(totalController.text.trim()) ??
                              0.0;
                          // Round to 2 decimal places safely
                          total = (total * 100).roundToDouble() / 100.0;
                          Map<String, dynamic>? cust;
                          final idx = _customers.indexWhere(
                            (c) => (c['id']?.toString() ?? '') == selected,
                          );
                          if (idx >= 0) cust = _customers[idx];

                          final orderId =
                              'ORD-${DateTime.now().millisecondsSinceEpoch}';
                          final order = {
                            'id': orderId,
                            'customer_id': cust?['id'] ?? selected,
                            'customer_name': cust?['name'] ?? '',
                            'items': [],
                            'total': total,
                            'delivery_status': 'pending',
                            'created_at': DateTime.now().toIso8601String(),
                            'delivery_date': null,
                          };

                          await ApiStorageService.addSaleOrder(order);
                          await _loadOrders();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Order created')),
                            );
                          }
                          Navigator.of(context).pop();
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                  ),
                  child: const Text(
                    'Create',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ],
            );
          },
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
          'Sale Orders',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
        ),
      ),
      body: _orders.isEmpty
          ? Center(
              child: Text(
                'No sale orders yet. Tap + to create one.',
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _orders.length,
              itemBuilder: (context, index) {
                final order = _orders[index];
                final orderId = order['id'] ?? 'N/A';
                final status = order['delivery_status'] ?? 'pending';
                final total = order['total'] ?? 0;
                final customer = order['customer_name'] ?? '';

                return Card(
                  color: const Color(0xFF161B22),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(
                      Icons.receipt_long,
                      color: Colors.greenAccent,
                    ),
                    title: Text(
                      orderId,
                      style: const TextStyle(color: Colors.white),
                    ),
                    subtitle: Text(
                      'Customer: $customer\nStatus: $status',
                      style: const TextStyle(color: Colors.white54),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          formatPKR(total),
                          style: const TextStyle(color: Colors.white70),
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.check,
                            color: Colors.greenAccent,
                          ),
                          onPressed: () async {
                            final id = order['id']?.toString() ?? '';
                            final date = DateTime.now().toIso8601String();
                            await ApiStorageService.updateSaleOrderStatusById(
                              id,
                              'delivered',
                              deliveryDate: date,
                            );
                            await _loadOrders();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Order marked delivered'),
                                ),
                              );
                            }
                          },
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.close,
                            color: Colors.redAccent,
                          ),
                          onPressed: () async {
                            final id = order['id']?.toString() ?? '';
                            await ApiStorageService.updateSaleOrderStatusById(
                              id,
                              'not_delivered',
                              deliveryDate: DateTime.now().toIso8601String(),
                            );
                            await _loadOrders();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Order marked not delivered'),
                                ),
                              );
                            }
                          },
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.picture_as_pdf,
                            color: Colors.blueAccent,
                          ),
                          onPressed: () => _generateAndOpenPDF(order),
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.delete,
                            color: Colors.redAccent,
                          ),
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (context) => AlertDialog(
                                backgroundColor: const Color(0xFF161B22),
                                title: const Text(
                                  'Delete Order',
                                  style: TextStyle(color: Colors.white),
                                ),
                                content: const Text(
                                  'Are you sure you want to delete this order?',
                                  style: TextStyle(color: Colors.white70),
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.of(context).pop(false),
                                    child: const Text(
                                      'Cancel',
                                      style: TextStyle(color: Colors.white70),
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.of(context).pop(true),
                                    child: const Text(
                                      'Delete',
                                      style: TextStyle(color: Colors.redAccent),
                                    ),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true) {
                              await ApiStorageService.deleteSaleOrder(
                                index,
                              );
                              await _loadOrders();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Order deleted'),
                                  ),
                                );
                              }
                            }
                          },
                        ),
                      ],
                    ),
                    isThreeLine: true,
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateOrderDialog,
        backgroundColor: Colors.blueAccent,
        child: const Icon(Icons.add),
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
