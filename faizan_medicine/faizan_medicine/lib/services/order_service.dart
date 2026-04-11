import 'package:flutter/material.dart';

import '../models/order_model.dart';
import '../services/api_storage_service.dart';

class OrderService extends ChangeNotifier {
  final List<Order> _orders = [];
  bool isLoading = false;

  List<Order> get orders => List.unmodifiable(_orders);

  int get totalOrders => _orders.length;

  int get deliveredCount => _orders.where((o) => o.status == 'delivered').length;

  int get pendingCount => _orders.where((o) => o.status != 'delivered').length;

  double get totalSales => _orders
      .where((o) => o.status == 'delivered')
      .fold(0.0, (sum, o) => sum + o.amount);

  Future<void> loadInitialData({Duration delay = const Duration(milliseconds: 700)}) async {
    isLoading = true;
    notifyListeners();
    await Future.delayed(delay);
    _orders.clear();
    final rawOrders = await ApiStorageService.loadSaleOrders();
    for (final raw in rawOrders) {
      _orders.add(Order.fromJson(raw));
    }
    isLoading = false;
    notifyListeners();
  }

  void addOrder(Order order) {
    _orders.add(order);
    notifyListeners();
  }

  void deleteOrder(String id) {
    _orders.removeWhere((o) => o.id == id);
    notifyListeners();
  }

  void markDelivered(String id) {
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) {
      _orders[idx].status = 'delivered';
      notifyListeners();
    }
  }

  // Replace data with a new list (e.g. "real" data source)
  void replaceAll(List<Order> newOrders) {
    _orders
      ..clear()
      ..addAll(newOrders);
    notifyListeners();
  }
}
