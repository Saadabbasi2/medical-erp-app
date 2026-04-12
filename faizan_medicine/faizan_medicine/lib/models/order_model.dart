class Order {
  final String id;
  final String customerName;
  final String route;
  final double amount;
  String status; // "delivered" | "pending" | "not_delivered"

  Order({
    required this.id,
    required this.customerName,
    this.route = '',
    required this.amount,
    required this.status,
  });

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    final statusRaw =
        (json['status'] ?? json['delivery_status'] ?? 'pending').toString();
    return Order(
      id: json['id']?.toString() ?? '',
      customerName:
          (json['customerName'] ?? json['customer_name'] ?? '').toString(),
      route: (json['route'] ?? '').toString(),
      amount: _toDouble(json['amount'] ?? json['total']),
      status: statusRaw,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'customerName': customerName,
        'route': route,
        'amount': amount,
        'status': status,
      };
}
