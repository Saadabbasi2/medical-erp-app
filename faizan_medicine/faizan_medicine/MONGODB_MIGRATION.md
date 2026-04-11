# MongoDB Migration Guide - Flutter Salesman App

## Overview
The Flutter Salesman App has been migrated from local JSON file storage to MongoDB via the ERP backend API. All data (Items, Customers, Sale Orders, History) is now stored in MongoDB on the same server as the ERP system.

## What Changed

### 1. New API Service
- **Old:** `JsonFileStorageService` (local file storage)
- **New:** `ApiStorageService` (MongoDB via API)

### 2. API Endpoints
All data operations now go through:
- Base URL: `http://84.247.169.194/api/salesman-app`
- Items: `/items` (GET, POST, PUT, DELETE)
- Customers: `/customers` (GET, POST, PUT, DELETE)
- Orders: `/orders` (GET, POST, PUT, PATCH, DELETE)
- History: `/history` (GET, POST)

### 3. MongoDB Collections
Data is stored in MongoDB collections:
- `salesmanitems` - Product/Item data
- `salesmancustomers` - Customer data
- `salesmanorders` - Sale orders
- `salesmanhistories` - Activity history

## Migration Steps

### Step 1: Update Import Statements
Replace in all files:
```dart
// OLD
import '../services/json_file_storage_service.dart';

// NEW
import '../services/api_storage_service.dart';
```

### Step 2: Replace Service Calls
Replace all method calls:
```dart
// OLD
JsonFileStorageService.loadItems()
JsonFileStorageService.addItem(item)
JsonFileStorageService.updateItem(index, item)
JsonFileStorageService.deleteItem(index)

// NEW
ApiStorageService.loadItems()
ApiStorageService.addItem(item)
ApiStorageService.updateItem(index, item)
ApiStorageService.deleteItem(index)
```

**Note:** The API service has the same method signatures, so most code works without changes!

### Step 3: Update API Base URL (For Cloud Deployment)
When deploying to cloud, update the API base URL in:
- `lib/services/api_storage_service.dart` - Change `_apiBase` constant
- `lib/screens/login.dart` - Change `_apiBase` constant

## Files That Need Updates

1. ✅ `lib/screens/login.dart` - Already updated (stores salesman ID)
2. ⬜ `lib/screens/items_screen.dart` - Replace import
3. ⬜ `lib/screens/customer_screen.dart` - Replace import
4. ⬜ `lib/screens/sale_order.dart` - Replace import
5. ⬜ `lib/screens/history.dart` - Replace import
6. ⬜ `lib/screens/dashboard.dart` - Replace import
7. ⬜ `lib/screens/day_end.dart` - Replace import
8. ⬜ `lib/services/order_stats_service.dart` - Replace import
9. ⬜ `lib/services/order_stats.dart` - Replace import
10. ⬜ `lib/services/report_service.dart` - Replace import

## Quick Migration Script

For each file, perform these replacements:

1. **Find:** `import '../services/json_file_storage_service.dart';`
   **Replace:** `import '../services/api_storage_service.dart';`

2. **Find:** `JsonFileStorageService.`
   **Replace:** `ApiStorageService.`

That's it! The API service has the same interface, so no other changes are needed.

## Testing

After migration:
1. Login to the app
2. Add an item → Check MongoDB: `db.salesmanitems.find()`
3. Add a customer → Check MongoDB: `db.salesmancustomers.find()`
4. Create a sale order → Check MongoDB: `db.salesmanorders.find()`
5. Check history → Check MongoDB: `db.salesmanhistories.find()`

All data should appear in MongoDB!

## Cloud Deployment

When deploying to cloud server:
1. Update `api_storage_service.dart`:
   ```dart
   static const String _apiBase = 'http://YOUR_SERVER_IP:3000/api/salesman-app';
   ```

2. Update `login.dart`:
   ```dart
   static const String _apiBase = 'http://YOUR_SERVER_IP:3000';
   ```

## Benefits

✅ All data centralized in MongoDB
✅ Real-time sync across devices
✅ No local file storage needed
✅ Data backed up on server
✅ Access from anywhere
✅ Same ERP database as main system

