import 'dart:convert';

import 'package:intl/intl.dart';
import 'package:pdf/widgets.dart' as pw;

import '../utils/pdf_saver.dart';
import 'api_storage_service.dart';

/// Service for generating sales reports (Day End Summary and Monthly Reports)
class ReportService {
  /// Helper method to build statistics table for PDF
  static pw.Widget _buildStatsTable({
    required int totalOrders,
    required int deliveredOrders,
    required int notDeliveredOrders,
    required int pendingOrders,
    required double totalSales,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(border: pw.Border.all()),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Total Orders:',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              ),
              pw.Text('$totalOrders'),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Delivered:',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              ),
              pw.Text('$deliveredOrders'),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Not Delivered:',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              ),
              pw.Text('$notDeliveredOrders'),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Pending:',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              ),
              pw.Text('$pendingOrders'),
            ],
          ),
          pw.SizedBox(height: 12),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Total Sales:',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              ),
              pw.Text('Rs. ${totalSales.toStringAsFixed(2)}'),
            ],
          ),
        ],
      ),
    );
  }

  /// Generates a Day End Summary report for today's orders
  /// - Filters orders completed today
  /// - Calculates totals (orders, delivered, not delivered, sales)
  /// - Generates PDF report
  /// - Saves as "DayEndSummary_<YYYY_MM_DD>.pdf"
  /// - Logs action in history
  static Future<Map<String, dynamic>> generateDayEndSummary() async {
    try {
      // Load sale orders
      final orders = await ApiStorageService.loadSaleOrders();

      // Get today's date (start and end of day in ISO 8601)
      final now = DateTime.now();
      final todayStart = DateTime(now.year, now.month, now.day);
      final todayEnd = DateTime(now.year, now.month, now.day, 23, 59, 59);

      // Filter orders created today
      final todayOrders = orders.where((order) {
        try {
          final createdAt = order['created_at'];
          if (createdAt == null) return false;
          final date = DateTime.parse(createdAt.toString());
          return date.isAfter(todayStart) && date.isBefore(todayEnd);
        } catch (e) {
          print('Error parsing date: $e');
          return false;
        }
      }).toList();

      // Calculate statistics
      final totalOrders = todayOrders.length;
      final deliveredOrders = todayOrders
          .where((o) => o['delivery_status']?.toString() == 'delivered')
          .length;
      final notDeliveredOrders = todayOrders
          .where((o) => o['delivery_status']?.toString() == 'not_delivered')
          .length;
      final pendingOrders = totalOrders - deliveredOrders - notDeliveredOrders;

      double totalSales = 0.0;
      for (final order in todayOrders) {
        final total = order['total'];
        if (total != null) {
          totalSales += (total is String ? double.parse(total) : total as num)
              .toDouble();
        }
      }

      // Generate PDF
      final pdf = pw.Document();
      final dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss');
      final reportDate = dateFormat.format(DateTime.now());

      pdf.addPage(
        pw.Page(
          build: (pw.Context context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Day End Summary Report',
                style: pw.TextStyle(
                  fontSize: 28,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Text(
                'Report Date: $reportDate',
                style: const pw.TextStyle(fontSize: 12),
              ),
              pw.SizedBox(height: 24),
              pw.Text(
                'Summary Statistics',
                style: pw.TextStyle(
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 12),
              _buildStatsTable(
                totalOrders: totalOrders,
                deliveredOrders: deliveredOrders,
                notDeliveredOrders: notDeliveredOrders,
                pendingOrders: pendingOrders,
                totalSales: totalSales,
              ),
              pw.SizedBox(height: 24),
              pw.Text(
                'Order Details',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 12),
              if (todayOrders.isNotEmpty)
                ...todayOrders.map((order) {
                  return pw.Container(
                    margin: const pw.EdgeInsets.only(bottom: 8),
                    padding: const pw.EdgeInsets.all(8),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(width: 0.5),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text(
                              'Order: ${order['id'] ?? 'N/A'}',
                              style: pw.TextStyle(
                                fontWeight: pw.FontWeight.bold,
                              ),
                            ),
                            pw.Text(
                              'Status: ${order['delivery_status'] ?? 'pending'}',
                              style: const pw.TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'Customer: ${order['customer_name'] ?? 'N/A'}',
                          style: const pw.TextStyle(fontSize: 11),
                        ),
                        pw.Text(
                          'Amount: Rs. ${(order['total'] ?? 0).toString()}',
                          style: const pw.TextStyle(fontSize: 11),
                        ),
                      ],
                    ),
                  );
                })
              else
                pw.Text(
                  'No orders for today',
                  style: const pw.TextStyle(fontSize: 12),
                ),
            ],
          ),
        ),
      );

      // Save PDF
      final bytes = await pdf.save();
      final today = DateFormat('yyyy_MM_dd').format(DateTime.now());
      final filename = 'DayEndSummary_$today.pdf';
      final filePath = await savePdf(bytes, filename);

      // Add history entry
      await ApiStorageService.addHistoryEntry({
        'id': DateTime.now().toIso8601String(),
        'module': 'Reports',
        'action': 'Day End Summary Report Generated',
        'timestamp': DateTime.now().toIso8601String(),
        'details': {
          'report_type': 'Day End Summary',
          'file_name': filename,
          'total_orders': totalOrders,
          'delivered': deliveredOrders,
          'not_delivered': notDeliveredOrders,
          'total_sales': totalSales,
        },
      });

      return {
        'success': true,
        'message': 'Day End Summary report generated successfully',
        'filePath': filePath,
        'fileName': filename,
        'stats': {
          'totalOrders': totalOrders,
          'delivered': deliveredOrders,
          'notDelivered': notDeliveredOrders,
          'totalSales': totalSales,
        },
      };
    } catch (e) {
      print('Error generating Day End Summary: $e');
      return {
        'success': false,
        'message': 'Error generating Day End Summary: $e',
      };
    }
  }

  /// Generates a Monthly Report for the specified month and year
  /// - Allows selecting month and year
  /// - Filters orders by selected month/year
  /// - Calculates totals (orders, delivered, not delivered, sales)
  /// - Generates PDF report
  /// - Saves as "Monthly_Report_<YYYY_MM>.pdf"
  /// - Logs action in history
  static Future<Map<String, dynamic>> generateMonthlyReport({
    required int month,
    required int year,
  }) async {
    try {
      // Validate month and year
      if (month < 1 || month > 12) {
        return {
          'success': false,
          'message': 'Invalid month. Please provide month between 1 and 12',
        };
      }

      if (year < 2000 || year > 2100) {
        return {
          'success': false,
          'message': 'Invalid year. Please provide a valid year',
        };
      }

      // Load sale orders
      final orders = await ApiStorageService.loadSaleOrders();

      // Filter orders for the specified month/year
      final monthStart = DateTime(year, month, 1);
      final monthEnd = month == 12
          ? DateTime(year + 1, 1, 1)
          : DateTime(year, month + 1, 1);

      final monthOrders = orders.where((order) {
        try {
          final createdAt = order['created_at'];
          if (createdAt == null) return false;
          final date = DateTime.parse(createdAt.toString());
          return date.isAfter(monthStart) && date.isBefore(monthEnd);
        } catch (e) {
          print('Error parsing date: $e');
          return false;
        }
      }).toList();

      // Calculate statistics
      final totalOrders = monthOrders.length;
      final deliveredOrders = monthOrders
          .where((o) => o['delivery_status']?.toString() == 'delivered')
          .length;
      final notDeliveredOrders = monthOrders
          .where((o) => o['delivery_status']?.toString() == 'not_delivered')
          .length;
      final pendingOrders = totalOrders - deliveredOrders - notDeliveredOrders;

      double totalSales = 0.0;
      for (final order in monthOrders) {
        final total = order['total'];
        if (total != null) {
          totalSales += (total is String ? double.parse(total) : total as num)
              .toDouble();
        }
      }

      // Format month name
      final monthName = DateFormat('MMMM').format(DateTime(year, month));

      // Generate PDF
      final pdf = pw.Document();
      final dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss');
      final reportDate = dateFormat.format(DateTime.now());

      pdf.addPage(
        pw.Page(
          build: (pw.Context context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Monthly Sales Report',
                style: pw.TextStyle(
                  fontSize: 28,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Text(
                'Period: $monthName $year',
                style: pw.TextStyle(
                  fontSize: 16,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.Text(
                'Report Generated: $reportDate',
                style: const pw.TextStyle(fontSize: 12),
              ),
              pw.SizedBox(height: 24),
              pw.Text(
                'Summary Statistics',
                style: pw.TextStyle(
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 12),
              _buildStatsTable(
                totalOrders: totalOrders,
                deliveredOrders: deliveredOrders,
                notDeliveredOrders: notDeliveredOrders,
                pendingOrders: pendingOrders,
                totalSales: totalSales,
              ),
              pw.SizedBox(height: 24),
              pw.Text(
                'Order Details',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 12),
              if (monthOrders.isNotEmpty)
                ...monthOrders.map((order) {
                  return pw.Container(
                    margin: const pw.EdgeInsets.only(bottom: 8),
                    padding: const pw.EdgeInsets.all(8),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(width: 0.5),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text(
                              'Order: ${order['id'] ?? 'N/A'}',
                              style: pw.TextStyle(
                                fontWeight: pw.FontWeight.bold,
                              ),
                            ),
                            pw.Text(
                              'Status: ${order['delivery_status'] ?? 'pending'}',
                              style: const pw.TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'Customer: ${order['customer_name'] ?? 'N/A'}',
                          style: const pw.TextStyle(fontSize: 11),
                        ),
                        pw.Text(
                          'Amount: Rs. ${(order['total'] ?? 0).toString()}',
                          style: const pw.TextStyle(fontSize: 11),
                        ),
                        pw.Text(
                          'Date: ${order['created_at'] ?? 'N/A'}',
                          style: const pw.TextStyle(fontSize: 10),
                        ),
                      ],
                    ),
                  );
                })
              else
                pw.Text(
                  'No orders for $monthName $year',
                  style: const pw.TextStyle(fontSize: 12),
                ),
            ],
          ),
        ),
      );

      // Save PDF
      final bytes = await pdf.save();
      final yearMonth = DateFormat('yyyy_MM').format(DateTime(year, month));
      final filename = 'Monthly_Report_$yearMonth.pdf';
      final filePath = await savePdf(bytes, filename);

      // Add history entry
      await ApiStorageService.addHistoryEntry({
        'id': DateTime.now().toIso8601String(),
        'module': 'Reports',
        'action': 'Monthly Report Generated',
        'timestamp': DateTime.now().toIso8601String(),
        'details': {
          'report_type': 'Monthly Report',
          'file_name': filename,
          'month': month,
          'year': year,
          'total_orders': totalOrders,
          'delivered': deliveredOrders,
          'not_delivered': notDeliveredOrders,
          'total_sales': totalSales,
        },
      });

      return {
        'success': true,
        'message': 'Monthly report for $monthName $year generated successfully',
        'filePath': filePath,
        'fileName': filename,
        'stats': {
          'totalOrders': totalOrders,
          'delivered': deliveredOrders,
          'notDelivered': notDeliveredOrders,
          'totalSales': totalSales,
        },
      };
    } catch (e) {
      print('Error generating Monthly Report: $e');
      return {
        'success': false,
        'message': 'Error generating Monthly Report: $e',
      };
    }
  }
}
