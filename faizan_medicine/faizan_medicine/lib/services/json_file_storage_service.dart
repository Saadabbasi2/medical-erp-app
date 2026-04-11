import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart' show rootBundle;
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/documents_helper.dart';

/// Service for reading and writing JSON data to storage.
/// Uses SharedPreferences for web platform and file storage for native platforms.
class JsonFileStorageService {
  static const String _itemsKey = 'items_data';
  static const String _customersKey = 'customers_data';
  static const String _saleOrdersKey = 'sale_orders_data';
  static const String _historyKey = 'history_data';
  static List<Map<String, dynamic>> _historyCache = [];
  static final StreamController<List<Map<String, dynamic>>> _historyController =
      StreamController<List<Map<String, dynamic>>>.broadcast();
  static List<Map<String, dynamic>> _saleOrdersCache = [];
  static final StreamController<List<Map<String, dynamic>>>
  _saleOrdersController =
      StreamController<List<Map<String, dynamic>>>.broadcast();

  /// Stream of history entries. Emits the full list (newest last) when changed.
  static Stream<List<Map<String, dynamic>>> get historyStream =>
      _historyController.stream;

  /// Stream of sale orders. Emits the full list when changed.
  static Stream<List<Map<String, dynamic>>> get saleOrdersStream =>
      _saleOrdersController.stream;
  static SharedPreferences? _prefsInstance;

  static Future<SharedPreferences> get _prefs async {
    if (_prefsInstance != null) return _prefsInstance!;
    _prefsInstance = await SharedPreferences.getInstance();
    return _prefsInstance!;
  }

  /// Loads items data from storage.
  static Future<List<Map<String, dynamic>>> loadItems() async {
    try {
      final prefs = await _prefs;
      final String? jsonString = prefs.getString(_itemsKey);

      if (jsonString != null && jsonString.isNotEmpty) {
        // Load from storage
        final data = json.decode(jsonString) as List<dynamic>;
        return data.map((item) => Map<String, dynamic>.from(item)).toList();
      } else {
        // Load from assets and save to storage
        final assetData = await rootBundle.loadString('assets/data/items.json');
        final data = json.decode(assetData) as List<dynamic>;
        final items = data
            .map((item) => Map<String, dynamic>.from(item))
            .toList();

        // Save to storage for future use
        await saveItems(items);
        return items;
      }
    } catch (e) {
      print('Error loading items: $e');
      // Return empty list on error
      return [];
    }
  }

  /// Saves items data to storage.
  static Future<void> saveItems(List<Map<String, dynamic>> items) async {
    try {
      final prefs = await _prefs;
      final jsonString = json.encode(items);
      final success = await prefs.setString(_itemsKey, jsonString);
      if (!success) {
        throw Exception('Failed to save items data');
      }
      print('Items saved successfully: ${items.length} items');
    } catch (e) {
      print('Error saving items: $e');
      throw Exception('Failed to save items data: $e');
    }
  }

  /// Loads customers data from storage.
  static Future<List<Map<String, dynamic>>> loadCustomers() async {
    try {
      final prefs = await _prefs;
      final String? jsonString = prefs.getString(_customersKey);

      if (jsonString != null) {
        // Load from storage
        final data = json.decode(jsonString) as List<dynamic>;
        return data
            .map((customer) => customer as Map<String, dynamic>)
            .toList();
      } else {
        // Load from assets and save to storage
        final assetData = await rootBundle.loadString(
          'assets/data/customers.json',
        );
        final data = json.decode(assetData) as List<dynamic>;
        final customers = data
            .map((customer) => customer as Map<String, dynamic>)
            .toList();

        // Save to storage for future use
        await saveCustomers(customers);
        return customers;
      }
    } catch (e) {
      print('Error loading customers: $e');
      // Return empty list on error
      return [];
    }
  }

  /// Saves customers data to storage.
  static Future<void> saveCustomers(
    List<Map<String, dynamic>> customers,
  ) async {
    try {
      final prefs = await _prefs;
      final jsonString = json.encode(customers);
      await prefs.setString(_customersKey, jsonString);
    } catch (e) {
      print('Error saving customers: $e');
      throw Exception('Failed to save customers data');
    }
  }

  /// Adds a new item to the items file.
  static Future<void> addItem(Map<String, dynamic> item) async {
    final items = await loadItems();
    items.add(item);
    await saveItems(items);
    // log history
    try {
      await addHistoryEntry({
        'id': DateTime.now().toIso8601String(),
        'module': 'Items',
        'action': 'Added item ${item['name'] ?? item['id'] ?? ''}',
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  /// Updates an existing item in the items file.
  static Future<void> updateItem(
    int index,
    Map<String, dynamic> updatedItem,
  ) async {
    final items = await loadItems();
    if (index >= 0 && index < items.length) {
      items[index] = updatedItem;
      await saveItems(items);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Items',
          'action':
              'Updated item ${updatedItem['name'] ?? updatedItem['id'] ?? ''}',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }

  /// Deletes an item from the items file.
  static Future<void> deleteItem(int index) async {
    final items = await loadItems();
    if (index >= 0 && index < items.length) {
      items.removeAt(index);
      await saveItems(items);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Items',
          'action': 'Deleted item at index $index',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }

  /// Adds a new customer to the customers file.
  static Future<void> addCustomer(Map<String, dynamic> customer) async {
    final customers = await loadCustomers();

    // Generate a new customer ID if none provided
    if (!customer.containsKey('id') ||
        customer['id'] == null ||
        customer['id'].toString().isEmpty) {
      // Find highest existing ID number
      int maxId = 0;
      for (var c in customers) {
        String id = c['id']?.toString() ?? '';
        if (id.startsWith('CUST-')) {
          try {
            int num = int.parse(id.substring(5));
            if (num > maxId) maxId = num;
          } catch (_) {}
        }
      }
      // Create new ID
      customer['id'] = 'CUST-${(maxId + 1).toString().padLeft(3, '0')}';
    }

    customers.add(customer);
    await saveCustomers(customers);
    try {
      await addHistoryEntry({
        'id': DateTime.now().toIso8601String(),
        'module': 'Customer',
        'action': 'Added customer ${customer['name'] ?? customer['id'] ?? ''}',
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  /// Loads sale orders data from storage.
  static Future<List<Map<String, dynamic>>> loadSaleOrders() async {
    try {
      // If running on web, path_provider/file IO isn't available — use prefs fallback.
      if (kIsWeb) {
        final prefs = await _prefs;
        final String? jsonString = prefs.getString(_saleOrdersKey);
        if (jsonString != null && jsonString.isNotEmpty) {
          final data = json.decode(jsonString) as List<dynamic>;
          _saleOrdersCache = data
              .map((o) => Map<String, dynamic>.from(o))
              .toList();
          _saleOrdersController.add(
            List<Map<String, dynamic>>.from(_saleOrdersCache),
          );
          return List<Map<String, dynamic>>.from(_saleOrdersCache);
        }
      }

      // Prefer file-based storage in application documents directory
      try {
        final dir = await getDocumentsDirectorySafe();
        final file = File('${dir.path}/sale_orders.json');
        if (await file.exists()) {
          final contents = await file.readAsString();
          if (contents.trim().isEmpty) {
            _saleOrdersCache = [];
          } else {
            final data = json.decode(contents) as List<dynamic>;
            _saleOrdersCache = data
                .map((o) => Map<String, dynamic>.from(o))
                .toList();
          }
          // emit
          _saleOrdersController.add(
            List<Map<String, dynamic>>.from(_saleOrdersCache),
          );
          return List<Map<String, dynamic>>.from(_saleOrdersCache);
        } else {
          // Try to initialize from bundled asset if available, otherwise start empty
          try {
            final assetData = await rootBundle.loadString(
              'assets/data/sale_orders.json',
            );
            final data = json.decode(assetData) as List<dynamic>;
            final orders = data
                .map((o) => Map<String, dynamic>.from(o))
                .toList();
            await saveSaleOrders(orders);
            return orders;
          } catch (e) {
            final List<Map<String, dynamic>> empty = [];
            await saveSaleOrders(empty);
            return empty;
          }
        }
      } catch (e) {
        // If path_provider is not available, fallback to SharedPreferences
        print('Error getting sale orders file path: $e');
        final prefs = await _prefs;
        final String? jsonString = prefs.getString(_saleOrdersKey);
        if (jsonString != null && jsonString.isNotEmpty) {
          final data = json.decode(jsonString) as List<dynamic>;
          _saleOrdersCache = data
              .map((o) => Map<String, dynamic>.from(o))
              .toList();
        } else {
          try {
            final assetData = await rootBundle.loadString(
              'assets/data/sale_orders.json',
            );
            final data = json.decode(assetData) as List<dynamic>;
            _saleOrdersCache = data
                .map((o) => Map<String, dynamic>.from(o))
                .toList();
            await saveSaleOrders(_saleOrdersCache);
          } catch (_) {
            _saleOrdersCache = [];
            await saveSaleOrders(_saleOrdersCache);
          }
        }
        _saleOrdersController.add(
          List<Map<String, dynamic>>.from(_saleOrdersCache),
        );
        return List<Map<String, dynamic>>.from(_saleOrdersCache);
      }
    } catch (e) {
      print('Error loading sale orders: $e');
      return [];
    }
  }

  /// Loads history data from storage.
  /// History entries are stored as a list of maps with fields like:
  /// {"id": "<uuid>", "action":"Day End Summary", "timestamp":"ISO8601", "file_path":"...", "meta": {...}}
  static Future<List<Map<String, dynamic>>> loadHistory() async {
    try {
      // Prefer file-based history stored in application documents directory
      final dir = await getDocumentsDirectorySafe();
      final file = File('${dir.path}/history.json');
      if (!await file.exists()) {
        await file.writeAsString(json.encode([]));
      }
      final contents = await file.readAsString();
      if (contents.trim().isEmpty) {
        _historyCache = [];
      } else {
        final data = json.decode(contents) as List<dynamic>;
        _historyCache = data.map((h) => Map<String, dynamic>.from(h)).toList();
      }
      // notify listeners
      _historyController.add(List<Map<String, dynamic>>.from(_historyCache));
      return List<Map<String, dynamic>>.from(_historyCache);
    } catch (e) {
      // Fallback to SharedPreferences-based history if path_provider is not available
      try {
        print('Error getting history file path: $e');
        final prefs = await _prefs;
        final String? jsonString = prefs.getString(_historyKey);
        if (jsonString != null && jsonString.isNotEmpty) {
          final data = json.decode(jsonString) as List<dynamic>;
          _historyCache = data
              .map((h) => Map<String, dynamic>.from(h))
              .toList();
        } else {
          _historyCache = [];
          await prefs.setString(_historyKey, json.encode(_historyCache));
        }
        _historyController.add(List<Map<String, dynamic>>.from(_historyCache));
        return List<Map<String, dynamic>>.from(_historyCache);
      } catch (e2) {
        print('Error loading history entries: $e2');
        _historyCache = [];
        _historyController.add([]);
        return [];
      }
    }
  }

  /// Saves history data to storage.
  static Future<void> saveHistory(List<Map<String, dynamic>> history) async {
    try {
      // If running on web, avoid file IO and use SharedPreferences instead
      if (kIsWeb) {
        final prefs = await _prefs;
        final jsonString = json.encode(history);
        final success = await prefs.setString(_historyKey, jsonString);
        if (!success) throw Exception('Failed to save history to prefs');
        _historyCache = List<Map<String, dynamic>>.from(history);
        _historyController.add(List<Map<String, dynamic>>.from(_historyCache));
        return;
      }

      final dir = await getDocumentsDirectorySafe();
      final file = File('${dir.path}/history.json');
      final jsonString = json.encode(history);
      await file.writeAsString(jsonString);
      _historyCache = List<Map<String, dynamic>>.from(history);
      _historyController.add(List<Map<String, dynamic>>.from(_historyCache));
    } catch (e) {
      // Fallback to SharedPreferences
      try {
        print('Error saving history to file: $e');
        final prefs = await _prefs;
        final jsonString = json.encode(history);
        final success = await prefs.setString(_historyKey, jsonString);
        if (!success) throw Exception('Failed to save history');
        _historyCache = List<Map<String, dynamic>>.from(history);
        _historyController.add(List<Map<String, dynamic>>.from(_historyCache));
      } catch (e2) {
        print('Error saving history: $e2');
        throw Exception('Failed to save history: $e2');
      }
    }
  }

  /// Adds a single history record.
  static Future<void> addHistoryEntry(Map<String, dynamic> entry) async {
    try {
      final history = await loadHistory();
      history.add(entry);
      await saveHistory(history);
    } catch (e) {
      print('Error adding history entry: $e');
      // best effort: try to save via prefs
      try {
        final prefs = await _prefs;
        final String? jsonString = prefs.getString(_historyKey);
        List<dynamic> data = [];
        if (jsonString != null && jsonString.isNotEmpty) {
          data = json.decode(jsonString) as List<dynamic>;
        }
        data.add(entry);
        await prefs.setString(_historyKey, json.encode(data));
        _historyCache = data.map((h) => Map<String, dynamic>.from(h)).toList();
        _historyController.add(List<Map<String, dynamic>>.from(_historyCache));
      } catch (_) {}
    }
  }

  /// Saves sale orders data to storage.
  static Future<void> saveSaleOrders(List<Map<String, dynamic>> orders) async {
    try {
      // If running on web, avoid file IO and write to SharedPreferences
      if (kIsWeb) {
        final prefs = await _prefs;
        final jsonString = json.encode(orders);
        final success = await prefs.setString(_saleOrdersKey, jsonString);
        if (!success) throw Exception('Failed to save sale orders to prefs');
        _saleOrdersCache = List<Map<String, dynamic>>.from(orders);
        _saleOrdersController.add(
          List<Map<String, dynamic>>.from(_saleOrdersCache),
        );
        return;
      }

      // Prefer writing to application documents directory
      try {
        final dir = await getDocumentsDirectorySafe();
        final file = File('${dir.path}/sale_orders.json');
        final jsonString = json.encode(orders);
        await file.writeAsString(jsonString);
        _saleOrdersCache = List<Map<String, dynamic>>.from(orders);
        _saleOrdersController.add(
          List<Map<String, dynamic>>.from(_saleOrdersCache),
        );
        return;
      } catch (e) {
        print('Error saving sale orders to file: $e');
        // Fallback to SharedPreferences
        final prefs = await _prefs;
        final jsonString = json.encode(orders);
        final success = await prefs.setString(_saleOrdersKey, jsonString);
        if (!success) throw Exception('Failed to save sale orders to prefs');
        _saleOrdersCache = List<Map<String, dynamic>>.from(orders);
        _saleOrdersController.add(
          List<Map<String, dynamic>>.from(_saleOrdersCache),
        );
        return;
      }
    } catch (e) {
      print('Error saving sale orders: $e');
      throw Exception('Failed to save sale orders: $e');
    }
  }

  /// Adds a new sale order.
  static Future<void> addSaleOrder(Map<String, dynamic> order) async {
    final orders = await loadSaleOrders();
    orders.add(order);
    await saveSaleOrders(orders);
    try {
      await addHistoryEntry({
        'id': DateTime.now().toIso8601String(),
        'module': 'Sale Order',
        'action': 'Created order ${order['id'] ?? ''}',
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  /// Update a sale order at index.
  static Future<void> updateSaleOrder(
    int index,
    Map<String, dynamic> updatedOrder,
  ) async {
    final orders = await loadSaleOrders();
    if (index >= 0 && index < orders.length) {
      orders[index] = updatedOrder;
      await saveSaleOrders(orders);
    }
  }

  /// Update only the delivery status (and optional delivery_date) of an order by index.
  static Future<void> updateSaleOrderStatus(
    int index,
    String status, {
    String? deliveryDate,
  }) async {
    final orders = await loadSaleOrders();
    if (index >= 0 && index < orders.length) {
      orders[index]['delivery_status'] = status;
      if (deliveryDate != null) orders[index]['delivery_date'] = deliveryDate;
      await saveSaleOrders(orders);
    }
  }

  /// Update a sale order by its id (safer than index-based updates).
  static Future<void> updateSaleOrderById(
    String id,
    Map<String, dynamic> updatedOrder,
  ) async {
    final orders = await loadSaleOrders();
    final idx = orders.indexWhere((o) => (o['id']?.toString() ?? '') == id);
    if (idx >= 0) {
      orders[idx] = updatedOrder;
      await saveSaleOrders(orders);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Sale Order',
          'action': 'Updated order $id',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }

  /// Update only the delivery status of an order by id.
  static Future<void> updateSaleOrderStatusById(
    String id,
    String status, {
    String? deliveryDate,
  }) async {
    final orders = await loadSaleOrders();
    final idx = orders.indexWhere((o) => (o['id']?.toString() ?? '') == id);
    if (idx >= 0) {
      orders[idx]['delivery_status'] = status;
      if (deliveryDate != null) orders[idx]['delivery_date'] = deliveryDate;
      await saveSaleOrders(orders);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Sale Order',
          'action': 'Order $id status changed to $status',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }

  /// Updates an existing customer in the customers file.
  static Future<void> updateCustomer(
    int index,
    Map<String, dynamic> updatedCustomer,
  ) async {
    final customers = await loadCustomers();
    if (index >= 0 && index < customers.length) {
      customers[index] = updatedCustomer;
      await saveCustomers(customers);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Customer',
          'action':
              'Updated customer ${updatedCustomer['name'] ?? updatedCustomer['id'] ?? ''}',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }

  /// Deletes a customer from the customers file.
  static Future<void> deleteCustomer(int index) async {
    final customers = await loadCustomers();
    if (index >= 0 && index < customers.length) {
      customers.removeAt(index);
      await saveCustomers(customers);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Customer',
          'action': 'Deleted customer at index $index',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }

  /// Deletes a sale order from the sale orders file.
  static Future<void> deleteSaleOrder(int index) async {
    final orders = await loadSaleOrders();
    if (index >= 0 && index < orders.length) {
      final orderId = orders[index]['id'] ?? '';
      orders.removeAt(index);
      await saveSaleOrders(orders);
      try {
        await addHistoryEntry({
          'id': DateTime.now().toIso8601String(),
          'module': 'Sale Order',
          'action': 'Deleted order $orderId',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } catch (_) {}
    }
  }
}
