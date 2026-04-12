import 'package:flutter/foundation.dart';

import '../models/order_model.dart';
import '../services/api_storage_service.dart';

class OrderService extends ChangeNotifier {
  final List<Order> _orders = [];
  /// True until the first successful load after MainScreen mounts (avoids empty flash).
  bool isLoading = true;

  List<Order> get orders => List.unmodifiable(_orders);

  int get totalOrders => _orders.length;

  int get deliveredCount => _orders.where((o) => o.status == 'delivered').length;

  int get pendingCount => _orders.where((o) => o.status != 'delivered').length;

  /// Sum of amounts for orders marked delivered (shown on home as delivered value).
  double get totalDeliveredAmount => _orders
      .where((o) => o.status == 'delivered')
      .fold(0.0, (sum, o) => sum + o.amount);

  Future<void> loadInitialData({Duration delay = Duration.zero}) async {
    isLoading = true;
    notifyListeners();
    try {
      if (delay > Duration.zero) {
        await Future.delayed(delay);
      }
      await _pullOrdersFromApi();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Reload orders from API without showing the full-screen loading state.
  Future<void> refreshFromApi() async {
    try {
      await _pullOrdersFromApi();
    } catch (e, st) {
      debugPrint('refreshFromApi: $e\n$st');
    }
    notifyListeners();
  }

  Future<void> _pullOrdersFromApi() async {
    _orders.clear();
    final rawOrders = await ApiStorageService.loadSaleOrders();
    for (final raw in rawOrders) {
      try {
        _orders.add(Order.fromJson(raw));
      } catch (e, st) {
        debugPrint('OrderService: skip bad order row: $e $raw\n$st');
      }
    }
  }

  void addOrder(Order order) {
    _orders.add(order);
    notifyListeners();
  }

  Future<void> deleteOrder(String id) async {
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx < 0) return;
    try {
      await ApiStorageService.deleteSaleOrder(idx);
      await _pullOrdersFromApi();
      notifyListeners();
    } catch (e, st) {
      debugPrint('deleteOrder: $e\n$st');
      rethrow;
    }
  }

  Future<void> markDelivered(String id) async {
    try {
      await ApiStorageService.updateSaleOrderStatusById(
        id,
        'delivered',
        deliveryDate: DateTime.now().toIso8601String(),
      );
      await _pullOrdersFromApi();
      notifyListeners();
    } catch (e, st) {
      debugPrint('markDelivered: $e\n$st');
      rethrow;
    }
  }

  Future<void> markNotDelivered(String id) async {
    try {
      await ApiStorageService.updateSaleOrderStatusById(
        id,
        'not_delivered',
        deliveryDate: DateTime.now().toIso8601String(),
      );
      await _pullOrdersFromApi();
      notifyListeners();
    } catch (e, st) {
      debugPrint('markNotDelivered: $e\n$st');
      rethrow;
    }
  }

  void replaceAll(List<Order> newOrders) {
    _orders
      ..clear()
      ..addAll(newOrders);
    notifyListeners();
  }

  /// Apply an order list already fetched from [ApiStorageService.loadSaleOrders]
  /// (avoids a second HTTP round-trip when Sale Order screen reloads).
  void replaceOrdersFromApiJson(List<Map<String, dynamic>> raw) {
    _orders.clear();
    for (final row in raw) {
      try {
        _orders.add(Order.fromJson(row));
      } catch (e, st) {
        debugPrint('replaceOrdersFromApiJson: skip row: $e $row\n$st');
      }
    }
    notifyListeners();
  }
}
