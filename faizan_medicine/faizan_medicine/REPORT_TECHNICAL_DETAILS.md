# Report Module - Technical Implementation Details

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              ReportsScreen (UI Layer)                   │
│  - User interactions (button taps)                      │
│  - Dialog management (month/year picker)               │
│  - State management (loading, messages)                │
│  - Result display (snackbars, cards)                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│          ReportService (Business Logic Layer)           │
│  - generateDayEndSummary()                             │
│  - generateMonthlyReport(month, year)                  │
│  - _buildStatsTable() [Helper]                         │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┼─────────┬──────────────┐
        │         │         │              │
        ▼         ▼         ▼              ▼
    ┌────────┐ ┌────┐  ┌──────────┐  ┌──────────┐
    │ PDF    │ │JSON│  │Notif.    │  │ Date     │
    │Package │ │Service│Service  │  │ Utils    │
    │(pdf)   │ │ │     │          │  │ (intl)   │
    └────────┘ └────┘  └──────────┘  └──────────┘
        │         │         │              │
        ▼         ▼         ▼              ▼
┌─────────────────────────────────────────────────────────┐
│              External Storage & Services                │
│  - sale_orders.json                                     │
│  - history.json                                         │
│  - Local Notifications                                  │
│  - App Documents Directory                              │
└─────────────────────────────────────────────────────────┘
```

## Code Structure

### ReportService Class

#### Method: generateDayEndSummary()

**Algorithm:**
```
1. LOAD ORDERS
   └─ Call JsonFileStorageService.loadSaleOrders()
   └─ Return: List<Map<String, dynamic>>

2. CALCULATE DATE BOUNDARIES
   └─ Get current DateTime
   └─ Create DateTime for start of day (00:00:00)
   └─ Create DateTime for end of day (23:59:59)

3. FILTER TODAY'S ORDERS
   └─ For each order:
      └─ Parse order['created_at'] to DateTime
      └─ Check if date is between todayStart and todayEnd
      └─ Keep order if true
   └─ Return: List<Map<String, dynamic>> [todayOrders]

4. CALCULATE STATISTICS
   └─ totalOrders = todayOrders.length
   └─ deliveredOrders = Count where delivery_status == 'delivered'
   └─ notDeliveredOrders = Count where delivery_status == 'not_delivered'
   └─ pendingOrders = totalOrders - deliveredOrders - notDeliveredOrders
   └─ totalSales = Sum of all order['total'] values
      ├─ Handle type coercion (String to double)
      └─ Accumulate with safe arithmetic

5. GENERATE PDF
   └─ Create pw.Document()
   └─ Format timestamp: 'yyyy-MM-dd HH:mm:ss'
   └─ Build page with Column layout:
      ├─ Title: "Day End Summary Report"
      ├─ Report Date timestamp
      ├─ "Summary Statistics" heading
      ├─ Call _buildStatsTable() with all stats
      ├─ "Order Details" heading
      └─ Map and render each today's order as Container with:
         ├─ Order ID and Status
         ├─ Customer name
         └─ Amount

6. SAVE PDF
   └─ Convert Document to bytes: pdf.save()
   └─ Format date: 'yyyy_MM_dd'
   └─ Create filename: 'DayEndSummary_{date}.pdf'
   └─ Call savePdf(bytes, filename)
   └─ Return: filePath

7. LOG TO HISTORY
   └─ Create entry object with:
      ├─ id: DateTime.now().toIso8601String()
      ├─ module: "Reports"
      ├─ action: "Day End Summary Report Generated"
      ├─ timestamp: DateTime.now().toIso8601String()
      └─ details: {report stats}
   └─ Call JsonFileStorageService.addHistoryEntry(entry)

8. SEND NOTIFICATION
   └─ Try:
      ├─ Generate unique ID: DateTime.millisecondsSinceEpoch
      ├─ Call NotificationService.showNotification()
      ├─ title: "Day End Summary Report"
      └─ body: "Day End Summary report generated successfully"
   └─ Catch: Log error but don't crash

9. RETURN RESULT
   └─ Return Map with:
      ├─ success: true
      ├─ message: "Day End Summary report generated successfully"
      ├─ filePath: full path to saved PDF
      ├─ fileName: filename only
      └─ stats: {detailed statistics}
```

#### Method: generateMonthlyReport(int month, int year)

**Algorithm:**
```
1. VALIDATE INPUTS
   └─ If month < 1 or month > 12: Return error
   └─ If year < 2000 or year > 2100: Return error

2. LOAD ORDERS
   └─ Same as Day End Summary

3. CALCULATE MONTH BOUNDARIES
   └─ monthStart = DateTime(year, month, 1)
   └─ If month == 12:
      └─ monthEnd = DateTime(year + 1, 1, 1)
   └─ Else:
      └─ monthEnd = DateTime(year, month + 1, 1)

4. FILTER MONTH'S ORDERS
   └─ For each order:
      └─ Parse order['created_at'] to DateTime
      └─ Check if date is between monthStart (inclusive) and monthEnd (exclusive)
      └─ Keep order if true

5. CALCULATE STATISTICS
   └─ Same calculation as Day End Summary

6. FORMAT MONTH NAME
   └─ Use DateFormat('MMMM').format(DateTime(year, month))
   └─ Result: "November", "December", etc.

7. GENERATE PDF
   └─ Similar to Day End Summary but:
      ├─ Title: "Monthly Sales Report"
      ├─ Include: "Period: {monthName} {year}"
      └─ Order list includes created_at timestamp

8. SAVE PDF
   └─ Format: 'yyyy_MM'
   └─ Filename: 'Monthly_Report_{yearMonth}.pdf'
   └─ Example: 'Monthly_Report_2025_11.pdf'

9. LOG TO HISTORY
   └─ Same as Day End Summary but:
      └─ details includes: month, year fields

10. SEND NOTIFICATION
    └─ body: "Monthly report {monthName} {year} generated successfully"

11. RETURN RESULT
    └─ Same as Day End Summary
```

#### Helper Method: _buildStatsTable()

**Parameters:**
```dart
{
  required int totalOrders,
  required int deliveredOrders,
  required int notDeliveredOrders,
  required int pendingOrders,
  required double totalSales
}
```

**Returns:** `pw.Widget` (PDF-renderable widget)

**Structure:**
```
pw.Container(
  ├─ padding: 12px all sides
  ├─ decoration: BoxDecoration with Border.all()
  └─ child: pw.Column
     ├─ Row 1: "Total Orders:" | {totalOrders}
     ├─ Spacer: 8px
     ├─ Row 2: "Delivered:" | {deliveredOrders}
     ├─ Spacer: 8px
     ├─ Row 3: "Not Delivered:" | {notDeliveredOrders}
     ├─ Spacer: 8px
     ├─ Row 4: "Pending:" | {pendingOrders}
     ├─ Spacer: 12px
     └─ Row 5: "Total Sales:" | "Rs. {totalSales(2 decimals)}"
```

## State Management

### ReportsScreen State Variables

```dart
bool _isGenerating = false;
// Controls loading spinner visibility
// Set to true when report generation starts
// Set to false when complete

String? _message = null;
// Stores success or error message
// Displayed in message card
// Null when no message to show

bool? _messageIsSuccess = null;
// Determines message styling
// true: Green background (success)
// false: Red background (error)
// null: No styling (no message)
```

### State Transitions

```
Initial State:
_isGenerating = false
_message = null
_messageIsSuccess = null

User taps button:
_isGenerating = true
_message = null

Report completes (success):
_isGenerating = false
_message = "..." (success message)
_messageIsSuccess = true

Report fails:
_isGenerating = false
_message = "..." (error message)
_messageIsSuccess = false
```

## Error Handling Strategy

### Level 1: Input Validation
```dart
// In generateMonthlyReport()
if (month < 1 || month > 12) {
  return {'success': false, 'message': 'Invalid month...'};
}
if (year < 2000 || year > 2100) {
  return {'success': false, 'message': 'Invalid year...'};
}
```

### Level 2: Safe Type Coercion
```dart
// When summing sales
totalSales += (total is String ? double.parse(total) : total as num)
              .toDouble();
```

### Level 3: Date Parsing Protection
```dart
try {
  final createdAt = order['created_at'];
  if (createdAt == null) return false;
  final date = DateTime.parse(createdAt.toString());
  return date.isAfter(todayStart) && date.isBefore(todayEnd);
} catch (e) {
  print('Error parsing date: $e');
  return false; // Skip this order
}
```

### Level 4: Top-Level Try-Catch
```dart
try {
  // All report generation logic
  ...
} catch (e) {
  print('Error generating Day End Summary: $e');
  return {
    'success': false,
    'message': 'Error generating Day End Summary: $e',
  };
}
```

### Level 5: Graceful Degradation
```dart
// Notifications are not critical
try {
  await NotificationService.showNotification(...);
} catch (e) {
  print('Error sending notification: $e');
  // Don't rethrow - report was generated successfully
}
```

## Performance Considerations

### Algorithm Complexity

**Time Complexity:**
- Day End Summary: O(n) where n = number of orders
  - One pass to filter today's orders
  - One pass to sum sales
  - One pass to generate PDF content
  - Total: O(n)

- Monthly Report: O(n) same analysis

**Space Complexity:**
- O(k) where k = orders in filter period
- PDF bytes: O(k * content_per_order)

### Performance Optimizations

1. **Single Pass Calculation**
   ```dart
   // Calculate stats while iterating
   for (final order in todayOrders) {
     // Count delivered, not delivered, pending
     // Sum sales
     // All in one pass
   }
   ```

2. **Lazy PDF Rendering**
   ```dart
   // PDF library only renders to bytes when needed
   final bytes = await pdf.save();
   // No rendering happens until bytes are needed
   ```

3. **File I/O Optimization**
   ```dart
   // Use flush=true for immediate disk write
   await file.writeAsBytes(bytes, flush: true);
   ```

### Benchmark Results (Expected)
- 0 orders: ~200-300ms (PDF overhead)
- 10 orders: ~300-400ms
- 100 orders: ~500-800ms
- 1000 orders: ~2-4 seconds

## Integration Points

### With JsonFileStorageService

**Methods Used:**
```dart
// Load orders
final orders = await JsonFileStorageService.loadSaleOrders();

// Log history
await JsonFileStorageService.addHistoryEntry({
  'id': DateTime.now().toIso8601String(),
  'module': 'Reports',
  'action': 'Day End Summary Report Generated',
  'timestamp': DateTime.now().toIso8601String(),
  'details': { /* stats */ }
});
```

### With NotificationService

**Methods Used:**
```dart
await NotificationService.showNotification(
  id: DateTime.now().millisecondsSinceEpoch.toUnsigned(31).toInt(),
  title: 'Day End Summary Report',
  body: 'Day End Summary report generated successfully',
);
```

### With PDF Utils

**Methods Used:**
```dart
final filePath = await savePdf(bytes, filename);
```

### With DateFormatting

**Methods Used:**
```dart
// Day formatting
final today = DateFormat('yyyy_MM_dd').format(DateTime.now());

// Month formatting
final monthName = DateFormat('MMMM').format(DateTime(year, month));

// Timestamp formatting
final dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss');
```

## Testing Recommendations

### Unit Tests

```dart
// Test Day End Summary generation with mock data
testWidgets('generateDayEndSummary with orders', (WidgetTester tester) {
  // Create mock orders for today
  // Call generateDayEndSummary()
  // Assert all statistics are correct
  // Assert PDF is created
  // Assert history is logged
});

// Test validation
test('generateMonthlyReport rejects invalid month', () {
  final result = ReportService.generateMonthlyReport(
    month: 13,
    year: 2025,
  );
  expect(result['success'], false);
});
```

### Integration Tests

```dart
// Test full flow from button tap to PDF creation
testWidgets('Day End Summary button tap to PDF', (WidgetTester tester) {
  await tester.pumpWidget(const MyApp());
  await tester.tap(find.byText('Generate Day End Summary'));
  await tester.pumpAndSettle(); // Wait for async operations
  // Verify PDF file exists
  // Verify notification sent
  // Verify history entry created
});
```

### Manual Testing Checklist

- [ ] Generate report with 0 orders
- [ ] Generate report with 1 order
- [ ] Generate report with 100+ orders
- [ ] Test date filtering accuracy
- [ ] Verify PDF file location
- [ ] Verify notification appears
- [ ] Check history.json for entries
- [ ] Test month/year picker validation
- [ ] Test error handling (invalid month)
- [ ] Test concurrent report generation
- [ ] Verify storage permissions

## Future Optimization Ideas

1. **Caching**: Cache orders list for repeated access
2. **Pagination**: Split large PDFs into multiple pages
3. **Templates**: Make PDF template configurable
4. **Export Formats**: Add CSV, Excel exports
5. **Scheduling**: Schedule automatic report generation
6. **Filtering**: Add filter options (customer, status)
7. **Aggregation**: Cache monthly aggregates
8. **Compression**: Compress old reports
