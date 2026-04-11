import '../services/api_storage_service.dart';

class OrderStatsService {
  static Future<Map<String, dynamic>> calculateTodayStats() async {
    final orders = await ApiStorageService.loadSaleOrders();
    final today = DateTime.now();

    double totalSales = 0;
    int deliveredOrders = 0;
    int notDeliveredOrders = 0;

    for (var order in orders) {
      final created = DateTime.parse(order['created_at']);
      if (created.year == today.year &&
          created.month == today.month &&
          created.day == today.day) {
        totalSales += order['total'] ?? 0;
        if (order['delivery_status'] == 'delivered') deliveredOrders++;
        if (order['delivery_status'] == 'not_delivered') notDeliveredOrders++;
      }
    }

    return {
      'total_sales': totalSales,
      'delivered_orders': deliveredOrders,
      'not_delivered_orders': notDeliveredOrders,
    };
  }

  static Future<Map<String, dynamic>> calculateOrderStats() async {
    final orders = await ApiStorageService.loadSaleOrders();

    int totalOrders = orders.length;
    int delivered = orders.where((o) => o['delivery_status'] == 'delivered').length;
    int notDelivered = orders.where((o) => o['delivery_status'] == 'not_delivered').length;

    return {
      'total_orders': totalOrders,
      'delivered_orders': delivered,
      'not_delivered_orders': notDelivered,
    };
  }
}
