import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/order_service.dart';
import '../models/order_model.dart';
import '../utils/format_utils.dart';
import 'customer_screen.dart';
import 'day_end.dart';
import 'export.dart';
import 'history.dart';
import 'import.dart';
import 'items_screen.dart';
import 'reports.dart';
import 'sale_order.dart';
import 'settings.dart';
// order_stats_service replaced by provider-backed OrderService
import '../widgets/glass_card.dart';



class MainScreen extends StatefulWidget {
  final String userName;
  final String userEmail;

  const MainScreen({
    super.key,
    required this.userName,
    required this.userEmail,
  });

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0;
  // We now use OrderService (provided at app root) to get live stats.

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<OrderService>().loadInitialData();
    });
  }

  void _openManageOrders() {
    final orderService = Provider.of<OrderService>(context, listen: false);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          builder: (_, controller) => Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                const Text('Manage Orders', style: TextStyle(color: Colors.black, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                Expanded(
                  child: Consumer<OrderService>(
                    builder: (_, svc, __) {
                      if (svc.isLoading) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      final orders = svc.orders;
                      if (orders.isEmpty) {
                        return const Center(child: Text('No orders', style: TextStyle(color: Colors.black54)));
                      }
                      return ListView.separated(
                        controller: controller,
                        itemCount: orders.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final o = orders[i];
                          final isDelivered = o.status == 'delivered';
                          final isNotDelivered = o.status == 'not_delivered';
                          final isPending = !isDelivered && !isNotDelivered;
                          return GlassCard(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(o.customerName, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                                      if (o.route.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          'Route: ${o.route}',
                                          style: const TextStyle(color: Colors.black45, fontSize: 12),
                                        ),
                                      ],
                                      const SizedBox(height: 6),
                                      Text('Amount: ${o.amount.toStringAsFixed(2)}', style: const TextStyle(color: Colors.black54, fontSize: 13)),
                                      if (isDelivered)
                                        const Padding(
                                          padding: EdgeInsets.only(top: 6),
                                          child: Text(
                                            'Delivered — status is final.',
                                            style: TextStyle(color: Colors.green, fontSize: 11),
                                          ),
                                        )
                                      else if (isNotDelivered)
                                        const Padding(
                                          padding: EdgeInsets.only(top: 6),
                                          child: Text(
                                            'Not delivered — status is final.',
                                            style: TextStyle(color: Colors.deepOrange, fontSize: 11),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      o.status,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDelivered
                                            ? Colors.green
                                            : isNotDelivered
                                                ? Colors.deepOrange
                                                : Colors.orange,
                                      ),
                                    ),
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (isPending)
                                          IconButton(
                                            icon: const Icon(Icons.check_circle, color: Colors.green),
                                            tooltip: 'Mark delivered',
                                            onPressed: () async {
                                              try {
                                                await svc.markDelivered(o.id);
                                              } catch (e) {
                                                if (ctx.mounted) {
                                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                                    SnackBar(content: Text('Could not update: $e')),
                                                  );
                                                }
                                              }
                                            },
                                          ),
                                        if (isPending)
                                          IconButton(
                                            icon: const Icon(Icons.cancel, color: Colors.redAccent),
                                            tooltip: 'Mark not delivered',
                                            onPressed: () async {
                                              try {
                                                await svc.markNotDelivered(o.id);
                                              } catch (e) {
                                                if (ctx.mounted) {
                                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                                    SnackBar(content: Text('Could not update: $e')),
                                                  );
                                                }
                                              }
                                            },
                                          ),
                                        IconButton(
                                          icon: const Icon(Icons.delete, color: Colors.redAccent),
                                          tooltip: 'Delete',
                                          onPressed: () async {
                                            try {
                                              await svc.deleteOrder(o.id);
                                            } catch (e) {
                                              if (ctx.mounted) {
                                                ScaffoldMessenger.of(ctx).showSnackBar(
                                                  SnackBar(content: Text('Could not delete: $e')),
                                                );
                                              }
                                            }
                                          },
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                // quick add form
                _AddOrderRow(onAdd: (cust, amt) {
                  final id = DateTime.now().millisecondsSinceEpoch.toString();
                  orderService.addOrder(Order(id: id, customerName: cust, amount: amt, status: 'pending'));
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  void _onItemTapped(int index) {
    setState(() => _selectedIndex = index);
    switch (index) {
      case 1:
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const ReportsScreen()),
        ).then((_) => setState(() => _selectedIndex = 0));
        break;
      case 2:
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const HistoryScreen()),
        ).then((_) => setState(() => _selectedIndex = 0));
        break;
      case 3:
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const SettingsScreen()),
        ).then((_) => setState(() => _selectedIndex = 0));
        break;
    }
  }

  Widget _enhancedOverviewCard({
    required IconData icon,
    required String title,
    required String mainValue,
    required int delivered,
    required int notDelivered,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Colors.black12,
                  radius: 18,
                  child: Icon(icon, color: Colors.black87, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.black54,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        mainValue,
                        style: const TextStyle(
                          color: Colors.black,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Delivered: $delivered',
                    style: const TextStyle(color: Colors.green, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Expanded(
                  child: Text(
                    'Not Delivered: $notDelivered',
                    style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _moduleTile(
    BuildContext context,
    IconData icon,
    String label,
    Widget screen,
    Color color,
  ) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (context) => screen));
      },
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              backgroundColor: color.withOpacity(0.2),
              radius: 24,
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHomeScreen() {
    final orderService = Provider.of<OrderService>(context);
    final isLoading = orderService.isLoading;
    final salesMainValue =
        isLoading ? '…' : formatPKR(orderService.totalDeliveredAmount);
    final ordersMainValue =
        isLoading ? '…' : orderService.totalOrders.toString();
    final deliveredCount = orderService.deliveredCount;
    final pendingCount = orderService.pendingCount;
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Today's Overview",
              style: TextStyle(
                color: Colors.black,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _enhancedOverviewCard(
                  icon: Icons.attach_money,
                  title: 'Delivered',
                  mainValue: salesMainValue,
                  delivered: deliveredCount,
                  notDelivered: pendingCount,
                ),
                const SizedBox(width: 10),
                _enhancedOverviewCard(
                  icon: Icons.shopping_cart,
                  title: 'Orders',
                  mainValue: ordersMainValue,
                  delivered: deliveredCount,
                  notDelivered: pendingCount,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton.icon(
                onPressed: _openManageOrders,
                icon: const Icon(Icons.manage_accounts),
                label: const Text('Manage Orders'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  side: const BorderSide(color: Colors.black12),
                ),
              ),
            ),
            const SizedBox(height: 25),
            const Text(
              "Sales Overview",
              style: TextStyle(
                color: Colors.black,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              height: 260,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(16),
              child: LineChart(
                LineChartData(
                  gridData: FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles:
                        AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles:
                        AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles:
                        AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 20,
                        interval: 1,
                        getTitlesWidget: (value, meta) {
                          final labels = [
                            '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'
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
                      dotData: FlDotData(show: true),
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
            const SizedBox(height: 25),
            const Text(
              "Modules",
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: 3,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _moduleTile(
                  context,
                  Icons.inventory,
                  "Items",
                  ItemsScreen(userEmail: widget.userEmail),
                  Colors.purple,
                ),
                _moduleTile(
                  context,
                  Icons.people,
                  "Customers",
                  CustomersScreen(userEmail: widget.userEmail),
                  Colors.indigo,
                ),
                _moduleTile(
                  context,
                  Icons.receipt_long,
                  "Sale Order",
                  SaleOrderScreen(
                    sessionUserName: widget.userName,
                    sessionEmail: widget.userEmail,
                  ),
                  Colors.green,
                ),
                _moduleTile(
                  context,
                  Icons.today,
                  "Day End",
                  const DayEndScreen(),
                  Colors.orange,
                ),
                _moduleTile(
                  context,
                  Icons.upload,
                  "Import",
                  const ImportScreen(),
                  Colors.cyan,
                ),
                _moduleTile(
                  context,
                  Icons.download,
                  "Export",
                  const ExportScreen(),
                  Colors.blueAccent,
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8.0),
          child: ProfileBar(
            showWelcome: true,
            userName: widget.userName,
            userEmail: widget.userEmail,
          ),
        ),
      ),
      body: SafeArea(child: _buildHomeScreen()),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: Colors.white,
        unselectedItemColor: Colors.black54,
        selectedItemColor: Colors.black,
        type: BottomNavigationBarType.fixed,
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: "Home"),
          BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: "Reports"),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: "History"),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: "Settings"),
        ],
      ),
    );
  }
}

// ---------------------- ProfileBar ----------------------
class ProfileBar extends StatelessWidget {
  final bool showWelcome;
  final String? userName;
  final String? userEmail;

  const ProfileBar({
    super.key,
    this.showWelcome = false,
    this.userName,
    this.userEmail,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Row(
        children: [
          // Avatar - slightly larger
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black12,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 6,
                  offset: const Offset(2, 3),
                ),
              ],
            ),
            child: const Icon(Icons.person, color: Colors.black, size: 30),
          ),
          const SizedBox(width: 14),

          // Name + Email
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (showWelcome)
                  Text(
                    'Welcome, ${userName ?? 'User'} 👋',
                    style: const TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.bold,
                      fontSize: 18, // slightly larger
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                if (userEmail != null)
                  Text(
                    userEmail!,
                    style: const TextStyle(
                      color: Colors.black54,
                      fontSize: 15, // slightly larger
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),

          // Notification Icon
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Colors.black),
            iconSize: 28,
            onPressed: () {},
          ),
        ],
      ),
    );
  }
}

// Small row widget used inside the Manage Orders sheet to quickly add an order
class _AddOrderRow extends StatefulWidget {
  final void Function(String customer, double amount) onAdd;
  const _AddOrderRow({required this.onAdd});

  @override
  State<_AddOrderRow> createState() => _AddOrderRowState();
}

class _AddOrderRowState extends State<_AddOrderRow> {
  final TextEditingController _nameCtl = TextEditingController();
  final TextEditingController _amtCtl = TextEditingController();

  @override
  void dispose() {
    _nameCtl.dispose();
    _amtCtl.dispose();
    super.dispose();
  }

  void _onAdd() {
    final name = _nameCtl.text.trim();
    final amt = double.tryParse(_amtCtl.text.trim()) ?? 0.0;
    if (name.isEmpty || amt <= 0) return;
    widget.onAdd(name, amt);
    _nameCtl.clear();
    _amtCtl.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: TextField(
              controller: _nameCtl,
              style: const TextStyle(color: Colors.black),
              decoration: const InputDecoration(hintText: 'Customer', hintStyle: TextStyle(color: Colors.black54), border: InputBorder.none),
            ),
          ),
          Expanded(
            flex: 2,
            child: TextField(
              controller: _amtCtl,
              keyboardType: TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: Colors.black),
              decoration: const InputDecoration(hintText: 'Amount', hintStyle: TextStyle(color: Colors.black54), border: InputBorder.none),
            ),
          ),
          ElevatedButton(onPressed: _onAdd, child: const Text('Add'))
        ],
      ),
    );
  }
}
