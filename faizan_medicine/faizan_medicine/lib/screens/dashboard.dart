import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'reports.dart';
import '../widgets/glass_card.dart';
import '../services/api_storage_service.dart';
import '../utils/format_utils.dart';
import 'history.dart';
import 'settings.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  double _totalRevenue = 0.0;

  @override
  void initState() {
    super.initState();
    _loadTotalRevenue();
  }

  Future<void> _loadTotalRevenue() async {
    try {
      final orders = await ApiStorageService.loadSaleOrders();
      double total = 0.0;
      for (var o in orders) {
        total += (o['total'] as num? ?? 0).toDouble();
      }
      if (mounted) {
        setState(() {
          _totalRevenue = total;
        });
      }
    } catch (e) {
      print('Error loading total revenue: $e');
    }
  }

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text(
          'Dashboard',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.bold,
            fontSize: 24,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Quick Stats",
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w600,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                _statCard(
                  Icons.attach_money,
                  'Revenue',
                  formatPKR(_totalRevenue),
                ),
                _statCard(Icons.shopping_bag, 'Orders', '62'),
              ],
            ),

            // Increased spacing before Sales Overview section
            const SizedBox(height: 40),

            const Text(
              "Sales Overview",
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w600,
                fontSize: 18,
              ),
            ),

            // More spacing before graph
            const SizedBox(height: 20),

            // Graph Section (Height Doubled)
            SizedBox(
              height: 320, // doubled height for visibility
              child: GlassCard(
                padding: const EdgeInsets.all(16),
                child: LineChart(
                LineChartData(
                  gridData: FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    rightTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    topTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 22,
                        interval: 1,
                        getTitlesWidget: (value, meta) {
                          final labels = [
                            '01',
                            '02',
                            '03',
                            '04',
                            '05',
                            '06',
                            '07',
                            '08',
                            '09',
                            '10',
                          ];
                          if (value >= 0 && value < labels.length) {
                            return Text(
                              labels[value.toInt()],
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 10,
                              ),
                            );
                          }
                          return const SizedBox.shrink();
                        },
                      ),
                    ),
                  ),
                  minY: 0,
                  maxY: 8,
                  lineBarsData: [
                    LineChartBarData(
                      isCurved: true,
                      color: Colors.black87,
                      barWidth: 3.5,
                      isStrokeCapRound: true,
                      dotData: FlDotData(
                        show: true,
                        getDotPainter: (spot, percent, bar, index) =>
                            FlDotCirclePainter(
                              radius: 5,
                              color: Colors.white,
                              strokeWidth: 3,
                              strokeColor: Colors.black87,
                            ),
                      ),
                      belowBarData: BarAreaData(
                        show: true,
                        gradient: LinearGradient(
                          colors: [
                            Colors.black26,
                            Colors.transparent,
                          ],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                      spots: const [
                        FlSpot(0, 4),
                        FlSpot(1, 2),
                        FlSpot(2, 5),
                        FlSpot(3, 3),
                        FlSpot(4, 4.5),
                        FlSpot(5, 3.8),
                        FlSpot(6, 6),
                        FlSpot(7, 4.8),
                        FlSpot(8, 5.2),
                        FlSpot(9, 3.2),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: Colors.white,
        selectedItemColor: Colors.black,
        unselectedItemColor: Colors.black54,
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

  Widget _statCard(IconData icon, String label, String value) {
    return Expanded(
      child: GlassCard(
        margin: const EdgeInsets.symmetric(horizontal: 5),
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Icon(icon, color: Colors.black, size: 30),
            const SizedBox(height: 10),
            Text(
              value,
              style: const TextStyle(
                color: Colors.black,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
            Text(
              label,
              style: const TextStyle(color: Colors.black54),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ],
        ),
      ),
    );
  }
}
