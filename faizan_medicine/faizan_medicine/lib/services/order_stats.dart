import '../services/api_storage_service.dart';

class OrderStatsService {
  // Today's stats (for Sales card)
  static Future<Map<String, dynamic>> calculateTodayStats() async {
    final orders = await ApiStorageService.loadSaleOrders();

    final today = DateTime.now();
    double totalSales = 0.0;
    int deliveredOrders = 0;
    int notDeliveredOrders = 0;

    for (var order in orders) {
      final createdAt = DateTime.tryParse(order['created_at'] ?? '');
      if (createdAt != null &&
          createdAt.year == today.year &&
          createdAt.month == today.month &&
          createdAt.day == today.day) {
        totalSales += (order['total'] ?? 0);
        if ((order['delivery_status'] ?? '') == 'delivered') {
          deliveredOrders++;
        } else if ((order['delivery_status'] ?? '') == 'not_delivered') {
          notDeliveredOrders++;
        }
      }
    }

    return {
      'total_sales': totalSales,
      'delivered_orders': deliveredOrders,
      'not_delivered_orders': notDeliveredOrders,
    };
  }

  // Total orders stats (for Orders card)
  static Future<Map<String, dynamic>> calculateOrderStats() async {
    final orders = await ApiStorageService.loadSaleOrders();

    int totalOrders = orders.length;
    int deliveredOrders = 0;
    int notDeliveredOrders = 0;

    for (var order in orders) {
      final status = order['delivery_status'] ?? '';
      if (status == 'delivered') deliveredOrders++;
      if (status == 'not_delivered') notDeliveredOrders++;
    }

    return {
      'total_orders': totalOrders,
      'delivered_orders': deliveredOrders,
      'not_delivered_orders': notDeliveredOrders,
    };
  }
}
