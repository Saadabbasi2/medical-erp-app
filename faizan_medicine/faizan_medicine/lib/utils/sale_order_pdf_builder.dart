import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'format_utils.dart';

/// Sale order PDF aligned with ERP [utils/pdfTemplate.js] branding (logo + footer).
class SaleOrderPdfBuilder {
  SaleOrderPdfBuilder._();

  static const List<String> _footerLines = [
    'Faizan Medicine Company',
    'House No CB-81/1, Iqbal Road Supply Mansehra Road (Abbottabad)',
    'Phone: +92 3028225831 , +92 3127000265',
    'Email: fezanmc@gmail.com , fezanmc@yahoo.com',
    'Thank you for your business',
  ];

  static final PdfColor _brandGreen =
      PdfColor(0x04 / 255, 0x79 / 255, 0x2d / 255);
  static final PdfColor _headerFill =
      PdfColor(0xe6 / 255, 0xf4 / 255, 0xea / 255);
  static final PdfColor _rowAlt =
      PdfColor(0xfa / 255, 0xfa / 255, 0xfa / 255);
  static final PdfColor _grid =
      PdfColor(0xd9 / 255, 0xd9 / 255, 0xd9 / 255);

  static Future<Uint8List> build({
    required Map<String, dynamic> order,
    required String salesmanDisplay,
    required String salesmanEmail,
  }) async {
    Uint8List? logoBytes;
    try {
      final data = await rootBundle.load('assets/images/faizan_logo.png');
      logoBytes = data.buffer.asUint8List();
    } catch (_) {}

    final orderId = order['id'] ?? 'order';
    final customer = order['customer_name'] ?? '';
    final route = (order['route'] ?? '').toString();
    final status = order['delivery_status'] ?? 'pending';
    final total = order['total'];
    final createdAt = order['created_at'] ?? '';
    final deliveryDate = order['delivery_date'] ?? '';
    final items = (order['items'] as List<dynamic>?) ?? const [];

    final doc = pw.Document(
      author: 'Faizan Medicine',
      creator: 'Faizan Medicine ERP',
      title: 'Sale Order $orderId',
    );

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(40, 36, 40, 44),
        maxPages: 20,
        header: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  if (logoBytes != null)
                    pw.Image(
                      pw.MemoryImage(logoBytes),
                      width: 88,
                      height: 44,
                      fit: pw.BoxFit.contain,
                    )
                  else
                    pw.SizedBox(width: 88, height: 44),
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.center,
                      children: [
                        pw.Text(
                          'Faizan Medicine',
                          style: pw.TextStyle(
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                            color: _brandGreen,
                          ),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'Sale Order Details',
                          style: pw.TextStyle(
                            fontSize: 13,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.black,
                          ),
                        ),
                      ],
                    ),
                  ),
                  pw.SizedBox(width: 88),
                ],
              ),
              pw.SizedBox(height: 8),
              pw.Container(
                height: 2,
                color: _brandGreen,
              ),
              pw.SizedBox(height: 6),
              pw.Text(
                'Generated: ${DateTime.now().toString().split('.').first}',
                style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
              ),
            ],
          );
        },
        footer: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Divider(color: _grid, thickness: 0.6),
              pw.SizedBox(height: 4),
              ..._footerLines.map(
                (line) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 2),
                  child: pw.Text(
                    line,
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 8.5,
                      color: PdfColors.grey800,
                    ),
                  ),
                ),
              ),
              pw.SizedBox(height: 4),
              pw.Text(
                'Page ${context.pageNumber}',
                style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
            ],
          );
        },
        build: (pw.Context context) {
          return [
            pw.Container(
              decoration: pw.BoxDecoration(
                color: _headerFill,
                border: pw.Border.all(color: _brandGreen, width: 1),
                borderRadius: pw.BorderRadius.circular(4),
              ),
              padding: const pw.EdgeInsets.all(12),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'Salesman',
                    style: pw.TextStyle(
                      fontSize: 10,
                      fontWeight: pw.FontWeight.bold,
                      color: _brandGreen,
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text(
                    salesmanDisplay,
                    style: const pw.TextStyle(
                      fontSize: 11,
                      color: PdfColors.black,
                    ),
                  ),
                  if (salesmanEmail.isNotEmpty) ...[
                    pw.SizedBox(height: 2),
                    pw.Text(
                      salesmanEmail,
                      style: const pw.TextStyle(
                        fontSize: 9.5,
                        color: PdfColors.grey800,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            pw.SizedBox(height: 14),
            _metaRow('Order ID', orderId.toString()),
            _metaRow('Customer', customer.toString()),
            if (route.isNotEmpty) _metaRow('Route', route),
            _metaRow('Status', status.toString()),
            _metaRow('Total amount', formatPKR(total)),
            _metaRow('Created', createdAt.toString()),
            if (deliveryDate.toString().isNotEmpty)
              _metaRow('Delivery date', deliveryDate.toString()),
            pw.SizedBox(height: 14),
            pw.Text(
              'Items',
              style: pw.TextStyle(
                fontSize: 12,
                fontWeight: pw.FontWeight.bold,
                color: _brandGreen,
              ),
            ),
            pw.SizedBox(height: 8),
            if (items.isEmpty)
              pw.Text(
                'No item details',
                style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700),
              )
            else
              pw.Table(
                border: pw.TableBorder.all(color: _grid, width: 0.5),
                columnWidths: {
                  0: const pw.FlexColumnWidth(3.2),
                  1: const pw.FlexColumnWidth(0.9),
                  2: const pw.FlexColumnWidth(1.3),
                },
                children: [
                  pw.TableRow(
                    decoration: pw.BoxDecoration(color: _headerFill),
                    children: ['Product', 'Qty', 'Unit price']
                        .map(
                          (h) => pw.Padding(
                            padding: const pw.EdgeInsets.all(6),
                            child: pw.Text(
                              h,
                              style: pw.TextStyle(
                                fontSize: 10,
                                fontWeight: pw.FontWeight.bold,
                                color: _brandGreen,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  ...items.asMap().entries.map((entry) {
                    final it = entry.value;
                    final idx = entry.key;
                    Map<String, dynamic> row;
                    if (it is Map) {
                      row = Map<String, dynamic>.from(it);
                    } else {
                      row = {'name': it.toString(), 'quantity': 0, 'price': 0};
                    }
                    final name = row['name']?.toString() ?? '';
                    final qty = row['quantity'];
                    final price = row['price'];
                    return pw.TableRow(
                      decoration: pw.BoxDecoration(
                        color: idx.isEven ? PdfColors.white : _rowAlt,
                      ),
                      children: [
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(
                            name,
                            style: const pw.TextStyle(fontSize: 9.5),
                          ),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(
                            '$qty',
                            style: const pw.TextStyle(fontSize: 9.5),
                          ),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(
                            formatPKR(price),
                            style: const pw.TextStyle(fontSize: 9.5),
                          ),
                        ),
                      ],
                    );
                  }),
                ],
              ),
          ];
        },
      ),
    );

    return doc.save();
  }

  static pw.Widget _metaRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 5),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 118,
            child: pw.Text(
              '$label:',
              style: pw.TextStyle(
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
                color: _brandGreen,
              ),
            ),
          ),
          pw.Expanded(
            child: pw.Text(
              value,
              style: const pw.TextStyle(fontSize: 10, color: PdfColors.black),
            ),
          ),
        ],
      ),
    );
  }
}
