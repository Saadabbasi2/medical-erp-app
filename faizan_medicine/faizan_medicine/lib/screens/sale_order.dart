import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_storage_service.dart';
import '../services/order_service.dart';
import '../services/user_data_service.dart';
import '../utils/format_utils.dart';
import '../utils/pdf_saver.dart';
import '../utils/sale_order_pdf_builder.dart';
import 'history.dart';
import 'reports.dart';
import 'settings.dart';

Widget _orderStatusBanner({
  required IconData icon,
  required Color iconColor,
  required Color borderColor,
  required Color backgroundColor,
  required String message,
}) {
  return Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
    decoration: BoxDecoration(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: borderColor),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: iconColor, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
        ),
      ],
    ),
  );
}

class SaleOrderScreen extends StatefulWidget {
  /// Login session: same as home "Welcome" name (email local-part), e.g. [saad].
  final String? sessionUserName;
  final String? sessionEmail;

  const SaleOrderScreen({
    super.key,
    this.sessionUserName,
    this.sessionEmail,
  });

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
      if (!mounted) return;
      setState(() => _orders = orders);
      context.read<OrderService>().replaceOrdersFromApiJson(orders);
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
      final user = await UserDataService.loadUserData();
      final erpName = (user['salesmanName'] ?? '').toString().trim();
      final emailFromStore = (user['email'] ?? '').toString();
      final email = (widget.sessionEmail != null &&
              widget.sessionEmail!.trim().isNotEmpty)
          ? widget.sessionEmail!.trim()
          : emailFromStore;

      String salesmanDisplay = erpName;
      if (salesmanDisplay.isEmpty) {
        final s = widget.sessionUserName?.trim();
        if (s != null && s.isNotEmpty) {
          salesmanDisplay = s;
        }
      }
      if (salesmanDisplay.isEmpty && email.contains('@')) {
        salesmanDisplay = email.split('@').first;
      }
      if (salesmanDisplay.isEmpty) {
        salesmanDisplay = (user['username'] ?? '').toString();
      }
      if ((salesmanDisplay.isEmpty || salesmanDisplay == 'User') &&
          email.contains('@')) {
        salesmanDisplay = email.split('@').first;
      }
      if (salesmanDisplay.isEmpty) {
        salesmanDisplay = 'Salesman';
      }

      final bytes = await SaleOrderPdfBuilder.build(
        order: order,
        salesmanDisplay: salesmanDisplay,
        salesmanEmail: email,
      );
      final orderId = order['id'] ?? 'order';
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
                final statusRaw =
                    (order['delivery_status'] ?? 'pending').toString();
                final isDelivered = statusRaw == 'delivered';
                final isNotDelivered = statusRaw == 'not_delivered';
                final isPending = !isDelivered && !isNotDelivered;
                final total = order['total'] ?? 0;
                final customer = order['customer_name'] ?? '';
                final route = (order['route'] ?? '').toString();

                return Card(
                  color: const Color(0xFF161B22),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Icon(
                                Icons.receipt_long,
                                color: Colors.greenAccent,
                                size: 28,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    orderId,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Customer: $customer',
                                    style: const TextStyle(
                                      color: Colors.white54,
                                      fontSize: 14,
                                      height: 1.35,
                                    ),
                                    softWrap: true,
                                  ),
                                  if (route.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Route: $route',
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontSize: 14,
                                        height: 1.35,
                                      ),
                                      softWrap: true,
                                    ),
                                  ],
                                  const SizedBox(height: 8),
                                  if (isDelivered)
                                    _orderStatusBanner(
                                      icon: Icons.check_circle,
                                      iconColor: Colors.greenAccent,
                                      borderColor: Colors.greenAccent
                                          .withOpacity(0.45),
                                      backgroundColor: const Color(0xFF0D2B18),
                                      message:
                                          'This order has been delivered. '
                                          'You cannot change or cancel this status here — only PDF or delete.',
                                    )
                                  else if (isNotDelivered)
                                    _orderStatusBanner(
                                      icon: Icons.cancel_outlined,
                                      iconColor: Colors.orangeAccent,
                                      borderColor: Colors.orangeAccent
                                          .withOpacity(0.45),
                                      backgroundColor: const Color(0xFF2B1F0D),
                                      message:
                                          'This order has not been delivered. '
                                          'Status is final — only PDF or delete.',
                                    )
                                  else
                                    Text(
                                      'Status: Pending — tap ✓ when delivered '
                                      'or ✗ if not delivered.',
                                      style: const TextStyle(
                                        color: Colors.white54,
                                        fontSize: 13,
                                        height: 1.35,
                                      ),
                                      softWrap: true,
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Text(
                                formatPKR(total),
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Wrap(
                              alignment: WrapAlignment.end,
                              spacing: 0,
                              runSpacing: 0,
                              children: [
                                if (isPending)
                                  IconButton(
                                    constraints: const BoxConstraints(
                                      minWidth: 40,
                                      minHeight: 40,
                                    ),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(
                                      Icons.check,
                                      color: Colors.greenAccent,
                                      size: 22,
                                    ),
                                    tooltip: 'Mark delivered',
                                    onPressed: () async {
                                      final id = order['id']?.toString() ?? '';
                                      final date =
                                          DateTime.now().toIso8601String();
                                      await ApiStorageService
                                          .updateSaleOrderStatusById(
                                        id,
                                        'delivered',
                                        deliveryDate: date,
                                      );
                                      await _loadOrders();
                                      if (mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Order marked as delivered',
                                            ),
                                          ),
                                        );
                                      }
                                    },
                                  ),
                                if (isPending)
                                  IconButton(
                                    constraints: const BoxConstraints(
                                      minWidth: 40,
                                      minHeight: 40,
                                    ),
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(
                                      Icons.close,
                                      color: Colors.redAccent,
                                      size: 22,
                                    ),
                                    tooltip: 'Mark not delivered',
                                    onPressed: () async {
                                      final id = order['id']?.toString() ?? '';
                                      await ApiStorageService
                                          .updateSaleOrderStatusById(
                                        id,
                                        'not_delivered',
                                        deliveryDate:
                                            DateTime.now().toIso8601String(),
                                      );
                                      await _loadOrders();
                                      if (mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Order marked as not delivered',
                                            ),
                                          ),
                                        );
                                      }
                                    },
                                  ),
                                IconButton(
                                  constraints: const BoxConstraints(
                                    minWidth: 40,
                                    minHeight: 40,
                                  ),
                                  padding: EdgeInsets.zero,
                                  icon: const Icon(
                                    Icons.picture_as_pdf,
                                    color: Colors.blueAccent,
                                    size: 22,
                                  ),
                                  tooltip: 'PDF',
                                  onPressed: () =>
                                      _generateAndOpenPDF(order),
                                ),
                                IconButton(
                                  constraints: const BoxConstraints(
                                    minWidth: 40,
                                    minHeight: 40,
                                  ),
                                  padding: EdgeInsets.zero,
                                  icon: const Icon(
                                    Icons.delete,
                                    color: Colors.redAccent,
                                    size: 22,
                                  ),
                                  tooltip: 'Delete',
                                  onPressed: () async {
                                    final confirmed = await showDialog<bool>(
                                      context: context,
                                      builder: (context) => AlertDialog(
                                        backgroundColor:
                                            const Color(0xFF161B22),
                                        title: const Text(
                                          'Delete Order',
                                          style: TextStyle(color: Colors.white),
                                        ),
                                        content: const Text(
                                          'This permanently removes the order from your list. '
                                          'It will only appear again when the office assigns a new booking to you.',
                                          style: TextStyle(
                                            color: Colors.white70,
                                            height: 1.35,
                                          ),
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () =>
                                                Navigator.of(context)
                                                    .pop(false),
                                            child: const Text(
                                              'Cancel',
                                              style: TextStyle(
                                                color: Colors.white70,
                                              ),
                                            ),
                                          ),
                                          TextButton(
                                            onPressed: () =>
                                                Navigator.of(context)
                                                    .pop(true),
                                            child: const Text(
                                              'Delete',
                                              style: TextStyle(
                                                color: Colors.redAccent,
                                              ),
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
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
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
                          ],
                        ),
                      ],
                    ),
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
