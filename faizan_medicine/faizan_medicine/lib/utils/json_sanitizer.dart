import 'dart:convert';

/// Utility class for sanitizing data before JSON serialization.
/// Prevents errors like "Unsupported operation: _Namespace" by ensuring
/// only JSON-safe data types are included.
class JsonSanitizer {
  /// Sanitizes a Map for JSON serialization by removing or converting
  /// non-serializable objects like Flutter contexts, internal Dart objects, etc.
  static Map<String, dynamic> sanitizeMap(Map<String, dynamic> data) {
    final sanitized = <String, dynamic>{};

    data.forEach((key, value) {
      sanitized[key] = _sanitizeValue(value);
    });

    return sanitized;
  }

  /// Sanitizes a List for JSON serialization.
  static List<dynamic> sanitizeList(List<dynamic> data) {
    return data.map(_sanitizeValue).toList();
  }

  /// Recursively sanitizes a value for JSON serialization.
  static dynamic _sanitizeValue(dynamic value) {
    if (value == null) {
      return '';
    } else if (value is String || value is num || value is bool) {
      // Primitive types are safe
      return value;
    } else if (value is Map<String, dynamic>) {
      return sanitizeMap(value);
    } else if (value is List<dynamic>) {
      return sanitizeList(value);
    } else if (value is DateTime) {
      // Convert DateTime to ISO string
      return value.toIso8601String();
    } else {
      // For any other object type (including Flutter contexts, internal objects),
      // convert to string representation or skip if problematic
      try {
        // Try to convert to string
        return value.toString();
      } catch (e) {
        // If toString() fails, skip this value
        print('Warning: Skipping non-serializable value for key: $value');
        return '';
      }
    }
  }

  /// Safely encodes data to JSON string, sanitizing first if needed.
  static String safeEncode(dynamic data) {
    try {
      if (data is Map<String, dynamic>) {
        return json.encode(sanitizeMap(data));
      } else if (data is List<dynamic>) {
        return json.encode(sanitizeList(data));
      } else {
        return json.encode(data);
      }
    } catch (e) {
      print('Error during JSON encoding: $e');
      // Return empty JSON object as fallback
      return '{}';
    }
  }
}
