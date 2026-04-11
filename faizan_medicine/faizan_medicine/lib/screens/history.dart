import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/api_storage_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;
  StreamSubscription<List<Map<String, dynamic>>>? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = ApiStorageService.historyStream.listen((list) {
      if (mounted) {
        setState(() {
          _history = List<Map<String, dynamic>>.from(list.reversed);
          _loading = false;
        });
      }
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final h = await ApiStorageService.loadHistory();
    if (mounted) {
      setState(() {
        _history = h.reversed.toList();
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Icon _iconForModule(String module) {
    switch (module.toLowerCase()) {
      case 'sale order':
      case 'sale_order':
      case 'saleorder':
        return const Icon(Icons.receipt_long, color: Colors.orangeAccent);
      case 'customer':
        return const Icon(Icons.person, color: Colors.blueAccent);
      case 'export':
        return const Icon(Icons.download, color: Colors.yellowAccent);
      case 'import':
        return const Icon(Icons.upload_file, color: Colors.cyanAccent);
      case 'settings':
        return const Icon(Icons.settings, color: Colors.grey);
      case 'profile':
      case 'user':
        return const Icon(Icons.person, color: Colors.lightGreenAccent);
      case 'reports':
        return const Icon(Icons.bar_chart, color: Colors.indigoAccent);
      default:
        return const Icon(Icons.history, color: Colors.white70);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('History', style: TextStyle(color: Colors.white)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(12),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _history.isEmpty
            ? const Center(
                child: Text(
                  'No history yet',
                  style: TextStyle(color: Colors.white54),
                ),
              )
            : ListView.builder(
                itemCount: _history.length,
                itemBuilder: (context, index) {
                  final h = _history[index];
                  final module = (h['module'] ?? h['action'] ?? 'Unknown')
                      .toString();
                  final action = (h['action'] ?? '').toString();
                  final tsRaw = h['timestamp']?.toString() ?? '';
                  String timeLabel = tsRaw;
                  try {
                    final dt = DateTime.parse(tsRaw);
                    timeLabel = DateFormat('yyyy-MM-dd HH:mm').format(dt);
                  } catch (_) {}

                  return Card(
                    color: const Color(0xFF161B22),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      leading: _iconForModule(module),
                      title: Text(
                        action,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      subtitle: Text(
                        module,
                        style: const TextStyle(color: Colors.white54),
                      ),
                      trailing: Text(
                        timeLabel,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
