import 'package:flutter/material.dart';
import 'reports.dart';
import 'history.dart';
import 'settings.dart';
import '../services/api_storage_service.dart';
import 'package:pdf/widgets.dart' as pw;
import '../utils/pdf_saver.dart';

class DayEndScreen extends StatefulWidget {
  const DayEndScreen({super.key});

  @override
  State<DayEndScreen> createState() => _DayEndScreenState();
}

class _DayEndScreenState extends State<DayEndScreen> {
  int _selectedIndex = 0;

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
    if (index == 0) {
      Navigator.pop(context);
    } else if (index == 1) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const ReportsScreen()),
      );
    } else if (index == 2) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const HistoryScreen()),
      );
    } else if (index == 3) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const SettingsScreen()),
      );
    }
  }

  Future<void> _generateDayEndReport() async {
    try {
      final orders = await ApiStorageService.loadSaleOrders();
      final now = DateTime.now();
      final todayStr = DateTime(now.year, now.month, now.day);

      // consider orders created today
      final todays = orders.where((o) {
        final created = o['created_at'] as String?;
        if (created == null) return false;
        try {
          final dt = DateTime.parse(created);
          final d = DateTime(dt.year, dt.month, dt.day);
          return d == todayStr;
        } catch (e) {
          return false;
        }
      }).toList();

      final delivered = todays
          .where((o) => (o['delivery_status'] ?? '') == 'delivered')
          .toList();
      final notDelivered = todays
          .where((o) => (o['delivery_status'] ?? '') != 'delivered')
          .toList();

      double totalDelivered = 0.0;
      double totalNotDelivered = 0.0;
      for (var o in delivered) {
        totalDelivered += (o['total'] as num? ?? 0).toDouble();
      }
      for (var o in notDelivered) {
        totalNotDelivered += (o['total'] as num? ?? 0).toDouble();
      }

      // build PDF
      final pdf = pw.Document();
      final dateLabel =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      pdf.addPage(
        pw.Page(
          build: (pw.Context context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Day End Summary - $dateLabel',
                style: pw.TextStyle(
                  fontSize: 24,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 12),
              pw.Text(
                'Total Orders Today: ${todays.length}',
                style: const pw.TextStyle(fontSize: 16),
              ),
              pw.Text(
                'Delivered: ${delivered.length}  |  Total Amount: Rs. ${totalDelivered.toStringAsFixed(2)}',
                style: const pw.TextStyle(fontSize: 14),
              ),
              pw.Text(
                'Not Delivered: ${notDelivered.length}  |  Total Amount: Rs. ${totalNotDelivered.toStringAsFixed(2)}',
                style: const pw.TextStyle(fontSize: 14),
              ),
              pw.SizedBox(height: 16),
              pw.Text(
                'Delivered Orders',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              if (delivered.isEmpty)
                pw.Text('None', style: const pw.TextStyle(fontSize: 12)),
              ...delivered.map(
                (o) => pw.Bullet(
                  text:
                      '${o['id']} - ${o['customer_name'] ?? ''} - Rs. ${(o['total'] ?? 0).toString()}',
                ),
              ),
              pw.SizedBox(height: 12),
              pw.Text(
                'Not Delivered Orders',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              if (notDelivered.isEmpty)
                pw.Text('None', style: const pw.TextStyle(fontSize: 12)),
              ...notDelivered.map(
                (o) => pw.Bullet(
                  text:
                      '${o['id']} - ${o['customer_name'] ?? ''} - Rs. ${(o['total'] ?? 0).toString()}',
                ),
              ),
            ],
          ),
        ),
      );

      final bytes = await pdf.save();
      final filename = 'day_end_$dateLabel.pdf';
      try {
        final result = await savePdf(bytes, filename);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Day end report saved: $result')),
          );
        }
      } catch (e) {
        print('Error saving day end PDF: $e');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to save day end report')),
          );
        }
      }
    } catch (e) {
      print('Error generating day end report: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to generate day end report')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: const TextStyle(color: Colors.white),
        title: const Text(
          'Day End Summary',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
        ),
      ),
      body: Center(
        child: ElevatedButton.icon(
          onPressed: _generateDayEndReport,
          icon: const Icon(Icons.calendar_today, size: 32),
          label: const Text("Generate Report", style: TextStyle(fontSize: 18)),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.blueAccent,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20),
            minimumSize: const Size(200, 60),
          ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF161B22),
        selectedItemColor: Colors.blueAccent,
        unselectedItemColor: Colors.white70,
        type: BottomNavigationBarType.fixed,
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: "Home"),
          BottomNavigationBarItem(
            icon: Icon(Icons.bar_chart),
            label: "Reports",
          ),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: "History"),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: "Settings",
          ),
        ],
      ),
    );
  }
}
