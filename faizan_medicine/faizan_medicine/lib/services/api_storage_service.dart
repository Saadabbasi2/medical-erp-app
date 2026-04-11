import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// API-based storage service for Flutter Salesman App
/// Replaces JsonFileStorageService to use MongoDB via ERP backend API
class ApiStorageService {
  static const String _serverBase = 'http://84.247.169.194';
  static String? _currentSalesmanId; // Store logged-in salesman ID

  /// Set the current salesman ID (called after login)
  static void setSalesmanId(String salesmanId) {
    _currentSalesmanId = salesmanId;
  }

  /// Get current salesman ID
  static String? getSalesmanId() => _currentSalesmanId;

  // Stream controllers for real-time updates
  static final StreamController<List<Map<String, dynamic>>> _historyController =
      StreamController<List<Map<String, dynamic>>>.broadcast();
  static final StreamController<List<Map<String, dynamic>>> _saleOrdersController =
      StreamController<List<Map<String, dynamic>>>.broadcast();

  /// Stream of history entries
  static Stream<List<Map<String, dynamic>>> get historyStream =>
      _historyController.stream;

  /// Stream of sale orders
  static Stream<List<Map<String, dynamic>>> get saleOrdersStream =>
      _saleOrdersController.stream;

  // ==================== ITEMS API ====================

  /// Load all items
  static Future<List<Map<String, dynamic>>> loadItems() async {
    // Not required for the “ERP pushes orders to salesman” flow.
    // Keep returning empty list to avoid dummy data.
    return [];
  }

  /// Save items (add new)
  static Future<void> saveItems(List<Map<String, dynamic>> items) async {
    // This is a bulk operation - we'll add items one by one
    // In a real scenario, you might want a bulk endpoint
    for (var item in items) {
      await addItem(item);
    }
  }

  /// Add new item
  static Future<void> addItem(Map<String, dynamic> item) async {
    throw Exception('Items API not implemented on server');
  }

  /// Update item
  static Future<void> updateItem(int index, Map<String, dynamic> updatedItem) async {
    throw Exception('Items API not implemented on server');
  }

  /// Delete item
  static Future<void> deleteItem(int index) async {
    throw Exception('Items API not implemented on server');
  }

  // ==================== CUSTOMERS API ====================

  /// Load all customers
  static Future<List<Map<String, dynamic>>> loadCustomers() async {
    // Not required for the pushed-order workflow. Keep empty.
    return [];
  }

  /// Save customers (bulk)
  static Future<void> saveCustomers(List<Map<String, dynamic>> customers) async {
    // Bulk operation - add customers one by one
    for (var customer in customers) {
      await addCustomer(customer);
    }
  }

  /// Add new customer
  static Future<void> addCustomer(Map<String, dynamic> customer) async {
    throw Exception('Customers API not implemented on server');
  }

  /// Update customer
  static Future<void> updateCustomer(int index, Map<String, dynamic> updatedCustomer) async {
    throw Exception('Customers API not implemented on server');
  }

  /// Delete customer
  static Future<void> deleteCustomer(int index) async {
    throw Exception('Customers API not implemented on server');
  }

  // ==================== SALE ORDERS API ====================

  /// Load all sale orders
  static Future<List<Map<String, dynamic>>> loadSaleOrders() async {
    try {
      final sid = _currentSalesmanId;
      if (sid == null || sid.isEmpty) return [];

      final uri = Uri.parse('$_serverBase/api/salesman-orders?salesmanId=$sid');
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final data = json.decode(response.body) as List<dynamic>;
        final raw = data.map((o) => Map<String, dynamic>.from(o)).toList();

        // Normalize to UI-friendly shape used by screens:
        // { id, customer_name, total, delivery_status, created_at, items }
        final orders = <Map<String, dynamic>>[];
        for (final o in raw) {
          final notesStr = (o['notes'] ?? '').toString();
          Map<String, dynamic>? notes;
          try { notes = json.decode(notesStr) as Map<String, dynamic>; } catch (_) { notes = null; }

          final products = (notes?['products'] is List) ? (notes?['products'] as List) : <dynamic>[];
          final items = products.map((p) {
            if (p is Map) {
              return {
                'name': p['product']?.toString() ?? '',
                'quantity': (p['qty'] ?? 0),
                'price': (p['price'] ?? 0),
              };
            }
            return {'name': p.toString(), 'quantity': 0, 'price': 0};
          }).toList();

          orders.add({
            'id': o['id']?.toString() ?? '',
            'customer_name': (notes?['customer'] ?? '').toString(),
            'route': (notes?['route'] ?? '').toString(),
            'items': items,
            'total': (o['total_amount'] ?? 0),
            'delivery_status': (o['status'] ?? 'pending'),
            'created_at': (o['created_at'] ?? '').toString(),
            'delivery_date': null,
          });
        }

        _saleOrdersController.add(List<Map<String, dynamic>>.from(orders));
        return orders;
      }
      return [];
    } catch (e) {
      print('Error loading sale orders: $e');
      return [];
    }
  }

  /// Save sale orders (bulk)
  static Future<void> saveSaleOrders(List<Map<String, dynamic>> orders) async {
    // This is typically not used, but for compatibility
    // In a real scenario, you might want a bulk endpoint
    for (var order in orders) {
      await addSaleOrder(order);
    }
  }

  /// Add new sale order
  static Future<void> addSaleOrder(Map<String, dynamic> order) async {
    throw Exception('Sale order creation is handled by ERP');
  }

  /// Update sale order
  static Future<void> updateSaleOrder(int index, Map<String, dynamic> updatedOrder) async {
    throw Exception('Sale order update not supported');
  }

  /// Update sale order by ID
  static Future<void> updateSaleOrderById(String id, Map<String, dynamic> updatedOrder) async {
    throw Exception('Sale order update not supported');
  }

  /// Update sale order status
  static Future<void> updateSaleOrderStatus(int index, String status, {String? deliveryDate}) async {
    final orders = await loadSaleOrders();
    if (index >= 0 && index < orders.length) {
      final orderId = orders[index]['id']?.toString();
      if (orderId == null) {
        throw Exception('Order ID not found');
      }
      await updateSaleOrderStatusById(orderId, status, deliveryDate: deliveryDate);
    }
  }

  /// Update sale order status by ID
  static Future<void> updateSaleOrderStatusById(String id, String status, {String? deliveryDate}) async {
    try {
      final response = await http.patch(
        Uri.parse('$_serverBase/api/salesman-orders/$id/status'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'status': status,
          'delivery_date': deliveryDate,
        }),
      );
      if (response.statusCode != 200) {
        throw Exception('Failed to update order status: ${response.body}');
      }
      
      // Reload and emit
      final orders = await loadSaleOrders();
      _saleOrdersController.add(orders);
    } catch (e) {
      print('Error updating order status: $e');
      throw Exception('Failed to update order status: $e');
    }
  }

  /// Delete sale order
  static Future<void> deleteSaleOrder(int index) async {
    final orders = await loadSaleOrders();
    if (index >= 0 && index < orders.length) {
      final orderId = orders[index]['id']?.toString();
      if (orderId == null) {
        throw Exception('Order ID not found');
      }
      
      try {
        final response = await http.delete(Uri.parse('$_serverBase/api/salesman-orders/$orderId'));
        if (response.statusCode != 200) {
          throw Exception('Failed to delete sale order: ${response.body}');
        }
        
        // Reload and emit
        final orders = await loadSaleOrders();
        _saleOrdersController.add(orders);
      } catch (e) {
        print('Error deleting sale order: $e');
        throw Exception('Failed to delete sale order: $e');
      }
    }
  }

  // ==================== HISTORY API ====================

  /// Load all history
  static Future<List<Map<String, dynamic>>> loadHistory() async {
    // History API is not wired to the new MySQL salesman_orders flow yet.
    // Return empty list to avoid compile/runtime issues.
    _historyController.add(const <Map<String, dynamic>>[]);
    return [];
  }

  /// Save history (bulk)
  static Future<void> saveHistory(List<Map<String, dynamic>> history) async {
    // Typically not used, but for compatibility
    for (var entry in history) {
      await addHistoryEntry(entry);
    }
  }

  /// Add history entry
  static Future<void> addHistoryEntry(Map<String, dynamic> entry) async {
    // Not implemented on server (yet). Ignore.
    return;
  }
}

