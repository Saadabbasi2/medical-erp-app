import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/report_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  bool _isGenerating = false;
  String? _message;
  bool? _messageIsSuccess;

  /// Generates a Day End Summary report
  Future<void> _generateDayEndSummary() async {
    setState(() {
      _isGenerating = true;
      _message = null;
    });

    try {
      final result = await ReportService.generateDayEndSummary();

      if (mounted) {
        setState(() {
          _isGenerating = false;
          _message = result['message'] as String;
          _messageIsSuccess = result['success'] as bool;
        });

        // Show snackbar
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_message!),
              backgroundColor: _messageIsSuccess!
                  ? Colors.green
                  : Colors.redAccent,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isGenerating = false;
          _message = 'Error: $e';
          _messageIsSuccess = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error generating report: $e'),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  /// Opens a date picker to select month and year for monthly report
  Future<void> _selectMonthYear() async {
    final now = DateTime.now();

    // Show a dialog with month/year selection
    await showDialog(
      context: context,
      builder: (context) {
        int selectedMonth = now.month;
        int selectedYear = now.year;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF161B22),
              title: const Text(
                'Select Month and Year',
                style: TextStyle(color: Colors.white),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Month selection
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: DropdownButtonFormField<int>(
                      dropdownColor: const Color(0xFF161B22),
                      initialValue: selectedMonth,
                      decoration: const InputDecoration(
                        labelText: 'Select Month',
                        labelStyle: TextStyle(color: Colors.white70),
                        border: OutlineInputBorder(),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.white30),
                        ),
                      ),
                      items: List.generate(12, (index) {
                        final month = index + 1;
                        final monthName = DateFormat(
                          'MMMM',
                        ).format(DateTime(now.year, month));
                        return DropdownMenuItem<int>(
                          value: month,
                          child: Text(
                            '$monthName ($month)',
                            style: const TextStyle(color: Colors.white),
                          ),
                        );
                      }),
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => selectedMonth = value);
                        }
                      },
                    ),
                  ),
                  // Year selection
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: DropdownButtonFormField<int>(
                      dropdownColor: const Color(0xFF161B22),
                      initialValue: selectedYear,
                      decoration: const InputDecoration(
                        labelText: 'Select Year',
                        labelStyle: TextStyle(color: Colors.white70),
                        border: OutlineInputBorder(),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.white30),
                        ),
                      ),
                      items: List.generate(10, (index) {
                        final year = now.year - 5 + index;
                        return DropdownMenuItem<int>(
                          value: year,
                          child: Text(
                            year.toString(),
                            style: const TextStyle(color: Colors.white),
                          ),
                        );
                      }),
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => selectedYear = value);
                        }
                      },
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _generateMonthlyReport(selectedMonth, selectedYear);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                  ),
                  child: const Text('Generate'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  /// Generates a Monthly Report for the selected month and year
  Future<void> _generateMonthlyReport(int month, int year) async {
    setState(() {
      _isGenerating = true;
      _message = null;
    });

    try {
      final result = await ReportService.generateMonthlyReport(
        month: month,
        year: year,
      );

      if (mounted) {
        setState(() {
          _isGenerating = false;
          _message = result['message'] as String;
          _messageIsSuccess = result['success'] as bool;
        });

        // Show snackbar
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_message!),
              backgroundColor: _messageIsSuccess!
                  ? Colors.green
                  : Colors.redAccent,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isGenerating = false;
          _message = 'Error: $e';
          _messageIsSuccess = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error generating report: $e'),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 3),
          ),
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        elevation: 0,
        title: const Text(
          'Reports',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 24,
          ),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Message display
            if (_message != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _messageIsSuccess!
                      ? Colors.green.withOpacity(0.2)
                      : Colors.redAccent.withOpacity(0.2),
                  border: Border.all(
                    color: _messageIsSuccess! ? Colors.green : Colors.redAccent,
                    width: 1.5,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _message!,
                  style: TextStyle(
                    color: _messageIsSuccess! ? Colors.green : Colors.redAccent,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),

            // Day End Summary Section
            Card(
              color: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today,
                          color: Colors.blueAccent,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Day End Summary',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Generate report for today\'s orders',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'This report includes:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    _buildBulletPoint('Total orders created today'),
                    _buildBulletPoint('Number of delivered orders'),
                    _buildBulletPoint('Number of undelivered orders'),
                    _buildBulletPoint('Total sales amount'),
                    _buildBulletPoint('Detailed order breakdown'),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isGenerating
                            ? null
                            : _generateDayEndSummary,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blueAccent,
                          disabledBackgroundColor: Colors.grey,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: _isGenerating
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : const Text(
                                'Generate Day End Summary',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Monthly Report Section
            Card(
              color: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.bar_chart,
                          color: Colors.greenAccent,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Monthly Report',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Generate report for a specific month',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'This report includes:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    _buildBulletPoint('Total orders for the month'),
                    _buildBulletPoint('Delivery status breakdown'),
                    _buildBulletPoint('Monthly sales total'),
                    _buildBulletPoint('Customer-wise breakdown'),
                    _buildBulletPoint('Month-wise analysis'),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isGenerating ? null : _selectMonthYear,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.greenAccent,
                          disabledBackgroundColor: Colors.grey,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: _isGenerating
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : const Text(
                                'Generate Monthly Report',
                                style: TextStyle(
                                  color: Colors.black,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Information Card
            Card(
              color: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Report Information',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildInfoRow('Format', 'PDF Document'),
                    _buildInfoRow('Storage', 'App Documents Directory'),
                    _buildInfoRow('Notifications', 'Disabled'),
                    _buildInfoRow('History', 'All reports logged in history'),
                    const SizedBox(height: 8),
                    Text(
                      'Reports are automatically saved and can be accessed via your file manager.',
                      style: TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Helper widget to build bullet points
  Widget _buildBulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(right: 8, top: 6),
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white70,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  /// Helper widget to build info rows
  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
