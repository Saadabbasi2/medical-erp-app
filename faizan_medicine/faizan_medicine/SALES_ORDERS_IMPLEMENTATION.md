# Sales and Orders Cards Implementation Guide

## Overview
The Home screen now displays fully functional **Sales** and **Orders** cards that fetch real data from `sale_orders.json` and update live whenever orders are added or delivery status changes.

## Features Implemented

### 1. OrderStatsService (`lib/services/order_stats_service.dart`)
A new service that calculates order statistics from sale_orders.json:

**Methods:**
- `calculateOrderStats()` - Calculates statistics for ALL orders
- `calculateTodayStats()` - Calculates statistics for TODAY's orders only

**Returns:**
```dart
{
  'total_sales': double,           // Sum of all order totals
  'total_orders': int,             // Count of all orders
  'delivered_orders': int,         // Count of delivered orders
  'not_delivered_orders': int,     // Count of not delivered orders
  'pending_orders': int,           // Count of pending/other orders
}
```

**Error Handling:**
- Catches JSON parsing errors
- Returns default values (0s) if any error occurs
- Validates delivery status values (delivered, not_delivered, pending)
- Handles null/empty values gracefully

### 2. Enhanced MainScreen (`lib/screens/main_screen.dart`)

**New State Variables:**
```dart
double _todaySales = 0.0;              // Today's total sales
int _todayDelivered = 0;               // Today's delivered orders
int _todayNotDelivered = 0;            // Today's not delivered orders

int _totalOrders = 0;                  // Total all-time orders
int _totalDelivered = 0;               // Total all-time delivered
int _totalNotDelivered = 0;            // Total all-time not delivered
```

**Live Data Updates:**
- Subscribes to `JsonFileStorageService.saleOrdersStream`
- Automatically triggers `_loadOrderStats()` when sale_orders.json changes
- Uses `setState()` to update UI in real-time

**Initialization:**
```dart
@override
void initState() {
  super.initState();
  _loadOrderStats();  // Load initial data
  
  // Listen to stream for live updates
  _saleOrdersSubscription = JsonFileStorageService.saleOrdersStream
      .listen((_) {
        _loadOrderStats();
      });
}

@override
void dispose() {
  _saleOrdersSubscription.cancel();  // Clean up subscription
  super.dispose();
}
```

### 3. Enhanced Overview Cards (`_enhancedOverviewCard`)

**Features:**
- Displays main value (Sales amount or Order count)
- Shows delivery status breakdown with color indicators:
  - **Green dot** = Delivered orders
  - **Red dot** = Not Delivered orders
- Responsive layout that adapts to screen size
- Truncates long text with ellipsis

**Layout:**
```
┌─────────────────────────────────┐
│ [Icon] Title                    │
│ Main Value (e.g., Rs. 1,850)    │
│ ● Delivered: 3    ● Not Delivered: 2 │
└─────────────────────────────────┘
```

**Colors Used:**
- Main icon: Blue Accent
- Delivered indicator: Green Accent
- Not Delivered indicator: Red Accent
- Background: Dark (#161B22)
- Text: White/White70

## Data Flow

```
┌─────────────────────────────────────────────┐
│ sale_orders.json (in getApplicationDocuments) │
└────────────────┬────────────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────┐
    │ JsonFileStorageService          │
    │ - loadSaleOrders()              │
    │ - saleOrdersStream (emits data) │
    └────────────────┬────────────────┘
                     │
                     ↓
        ┌───────────────────────────┐
        │ OrderStatsService         │
        │ - calculateOrderStats()   │
        │ - calculateTodayStats()   │
        └────────────────┬──────────┘
                         │
                         ↓
            ┌─────────────────────────┐
            │ MainScreen (Home Tab)    │
            │ - Displays cards        │
            │ - Updates live          │
            └─────────────────────────┘
```

## Sample Data Format

The `sale_orders.json` file should follow this structure:

```json
[
  {
    "id": "ORD-001",
    "customer_name": "Ahmed Khan",
    "customer_phone": "0300-1234567",
    "items": [
      {"item_name": "Paracetamol", "quantity": 2, "price": 150}
    ],
    "total": 300,
    "delivery_status": "delivered",
    "created_at": "2025-11-11T09:30:00",
    "delivery_date": "2025-11-11T14:00:00"
  },
  {
    "id": "ORD-002",
    "customer_name": "Fatima Ali",
    "customer_phone": "0321-9876543",
    "items": [
      {"item_name": "Aspirin", "quantity": 1, "price": 200}
    ],
    "total": 200,
    "delivery_status": "not_delivered",
    "created_at": "2025-11-11T10:15:00"
  }
]
```

**Required Fields:**
- `total` (number or string) - Order total amount
- `delivery_status` (string) - One of: "delivered", "not_delivered", "pending"
- `created_at` (ISO 8601 datetime string) - When the order was created

**Status Values:**
- `"delivered"` - Order has been delivered
- `"not_delivered"` - Order could not be delivered
- `"pending"` - Order is pending delivery (any other status)

## Testing

### Add Test Data
Sample test data with 6 orders is included in `assets/data/sale_orders.json`:
- 3 delivered orders (Total: Rs. 1,000)
- 2 not delivered orders (Total: Rs. 850)
- 1 pending order (Total: Rs. 950)

### Test Live Updates
1. Open the app and navigate to Home tab
2. Cards will display:
   - **Sales Card**: Shows today's total sales and delivery breakdown
   - **Orders Card**: Shows total order count and delivery breakdown
3. Add a new order via the Sale Order module
4. Cards update automatically in real-time

### Verify Calculations
Use the test data to verify:
- Today's sales calculation
- Order count aggregation
- Delivery status categorization
- Proper error handling (try modifying JSON to have invalid values)

## Error Handling

The implementation includes robust error handling:

1. **JSON Parse Errors**: Returns default values (0s)
2. **Missing Fields**: Treats as 0 or "pending"
3. **Invalid Dates**: Skips the order
4. **Type Mismatches**: Converts strings to numbers where needed
5. **Null Values**: Safely handles null checks

Example:
```dart
// This order will be counted but total won't be added if invalid
{
  "id": "ORD-999",
  "customer_name": "Test",
  "total": "invalid",  // Will be skipped in sales calculation
  "delivery_status": null,  // Will be counted as "pending"
  "created_at": "2025-11-11"
}
```

## Performance Considerations

- **Lazy Loading**: Statistics are calculated on demand
- **Stream Subscription**: Only recalculates when data actually changes
- **Async Operations**: All calculations are async to prevent UI blocking
- **Memory**: Caches sales orders in memory via JsonFileStorageService

## Customization

### Change Card Layout
Edit `_enhancedOverviewCard()` in `main_screen.dart`:
- Modify colors
- Change icon sizes
- Adjust spacing
- Add more status categories

### Change Status Categories
Edit `OrderStatsService.calculateOrderStats()`:
```dart
final status = order['delivery_status']?.toString().toLowerCase() ?? '';
if (status == 'delivered') {
  deliveredCount++;
} else if (status == 'not_delivered' || status == 'not delivered') {
  notDeliveredCount++;
} else {
  pendingCount++;
}
```

### Add More Statistics
Extend `OrderStatsService` with new methods:
```dart
static Future<Map<String, dynamic>> calculateWeeklyStats() async {
  // Similar to calculateTodayStats() but for weekly data
}

static Future<double> calculateAverageOrderValue() async {
  // Calculate average order total
}
```

## Files Modified/Created

1. **Created**: `lib/services/order_stats_service.dart`
   - New service for calculating order statistics

2. **Modified**: `lib/screens/main_screen.dart`
   - Added live data loading
   - Enhanced card UI with status breakdown
   - Added stream subscription for live updates
   - Added proper cleanup in dispose()

3. **Updated**: `assets/data/sale_orders.json`
   - Added sample test data (6 orders with various statuses)

## Integration with Other Modules

- **Sale Order Module**: Creating/updating orders automatically updates cards via stream
- **Day End Module**: Can use OrderStatsService for daily summaries
- **Reports Module**: Can leverage calculated statistics

## Future Enhancements

1. **Date Range Filtering**: Calculate stats for custom date ranges
2. **Customer Filtering**: Show stats for specific customers
3. **Item-Level Stats**: Breakdown by medication type
4. **Charts**: Add visual charts showing delivery trends
5. **Export**: Export statistics as PDF/CSV

## Troubleshooting

### Cards Show "0" Values
- Check if sale_orders.json has data in application documents directory
- Verify JSON format matches the schema
- Check console for parsing errors

### Live Updates Not Working
- Ensure `dispose()` is properly implemented
- Check stream subscription in initState
- Verify JsonFileStorageService.saleOrdersStream is emitting

### Incorrect Calculations
- Verify delivery_status values match expected strings
- Check if order totals are valid numbers
- Review error messages in console

## Support

For issues or improvements, review:
- Order statistics logic: `order_stats_service.dart`
- UI rendering: `main_screen.dart` (_enhancedOverviewCard)
- Data flow: `json_file_storage_service.dart` (saleOrdersStream)
