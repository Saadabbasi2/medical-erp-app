class Order {
  final String id;
  final String customerName;
  final double amount;
  String status; // "delivered" or "pending"

  Order({
    required this.id,
    required this.customerName,
    required this.amount,
    required this.status,
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: json['id'].toString(),
        customerName: (json['customerName'] ?? json['customer_name'] ?? '') as String,
        amount: ((json['amount'] ?? json['total'] ?? 0) as num).toDouble(),
        status: (json['status'] ?? json['delivery_status'] ?? 'pending') as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'customerName': customerName,
        'amount': amount,
        'status': status,
      };
}
