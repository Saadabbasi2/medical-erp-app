String formatPKR(dynamic v) {
  try {
    double d;
    if (v == null) {
      d = 0.0;
    } else if (v is num) {
      d = v.toDouble();
    } else {
      d = double.tryParse(v.toString()) ?? 0.0;
    }
    return 'Rs. ${d.toStringAsFixed(2)}';
  } catch (e) {
    return 'Rs. 0.00';
  }
}
