# Report Module - Quick Start Guide

## Overview
The Report module provides two types of comprehensive sales reports in PDF format with local notifications and history tracking.

## How to Use

### 1. Day End Summary Report
Generates a summary of all orders completed today.

**Steps:**
1. Navigate to the Reports section from the app menu
2. In the "Day End Summary" card, tap the blue "Generate Day End Summary" button
3. The app will:
   - Show a loading spinner
   - Generate a PDF with today's statistics
   - Save it as `DayEndSummary_YYYY_MM_DD.pdf`
   - Send you a notification: "Day End Summary report generated successfully"
   - Log the action in history

**What's Included:**
- ✓ Total orders created today
- ✓ Number of delivered orders
- ✓ Number of undelivered orders
- ✓ Number of pending orders
- ✓ Total sales amount
- ✓ Detailed list of each order with customer and amount

**Example Filename:** `DayEndSummary_2025_11_11.pdf`

### 2. Monthly Report
Generates a comprehensive report for a specific month and year.

**Steps:**
1. Navigate to the Reports section
2. In the "Monthly Report" card, tap the green "Generate Monthly Report" button
3. A dialog will appear with month and year selectors
4. Select the desired month (January-December) and year (2020-2030)
5. Tap "Generate"
6. The app will:
   - Show a loading spinner
   - Generate a PDF with the month's statistics
   - Save it as `Monthly_Report_YYYY_MM.pdf`
   - Send you a notification: "Monthly report November 2025 generated successfully"
   - Log the action in history

**What's Included:**
- ✓ Total orders for the month
- ✓ Delivery status breakdown
- ✓ Monthly sales total
- ✓ Customer-wise breakdown
- ✓ Detailed order listing with dates

**Example Filename:** `Monthly_Report_2025_11.pdf`

## Features

### ✅ Automatic Notifications
- Each generated report triggers a local notification
- You can tap the notification to open the report
- Notifications appear immediately after generation

### ✅ History Logging
- Every report generation is logged with:
  - Timestamp
  - Report type (Day End or Monthly)
  - Report filename
  - All statistics (orders count, delivery status, sales total)
- Access history via the History section of the app
- View complete report generation timeline

### ✅ Professional PDF Format
- Clean, readable layout
- Organized statistics table
- Complete order details
- Professional formatting with borders and spacing
- Ready to print or share

### ✅ Smart Filtering
- Day End: Automatically shows only today's orders
- Monthly: Shows all orders from selected month/year
- Handles different timezones correctly
- Date parsing is robust and error-handled

## File Locations

### Generated Reports:
- **Where**: App Documents Directory (on your device)
- **Day End**: `DayEndSummary_YYYY_MM_DD.pdf`
- **Monthly**: `Monthly_Report_YYYY_MM.pdf`

### History Log:
- **Where**: `{App Documents Directory}/history.json`
- **Contains**: Complete log of all report generations

## Troubleshooting

### No orders appearing in report?
- **Day End**: Make sure you created orders today. Times are matched by date.
- **Monthly**: Verify you selected the correct month and year
- **Check Sale Orders**: Navigate to Sale Orders screen to verify data exists

### Report not generating?
1. Check if you have write permissions to app storage
2. Ensure notification permissions are enabled
3. Try again or restart the app
4. Check available storage space

### Notification not appearing?
- Grant notification permissions to the app
- Check your device's notification settings
- Some devices have aggressive notification filtering - check "Do Not Disturb" settings

### Can't find the PDF file?
- Reports are saved in the app's documents directory
- Use your device's file manager to navigate to app storage
- Look for `DayEndSummary_*.pdf` or `Monthly_Report_*.pdf` files

## Tips & Best Practices

1. **Generate reports regularly**: Create Day End Summary every evening
2. **Monthly reviews**: Generate monthly reports at month-end for accounting
3. **Keep history**: History is automatically logged - check it for audit trails
4. **Export**: If needed, share PDFs via email or cloud storage
5. **Archive**: Move old PDFs to external storage for backup

## Statistics Explained

### Total Orders
Count of all orders created in the period

### Delivered
Orders marked with status "delivered"

### Not Delivered
Orders marked with status "not_delivered"

### Pending
Orders that are still pending (total - delivered - not_delivered)

### Total Sales
Sum of all order amounts in the period

## Supported Date Range

- **Day End**: Current day only (UTC-based)
- **Monthly**: Any month from year 2000 to 2100
- **Default**: Today and current year

## Performance

- **Small datasets** (< 100 orders): Instant generation
- **Medium datasets** (100-1000 orders): < 2 seconds
- **Large datasets** (1000+ orders): Up to 5 seconds
- Reports are generated locally, no internet required

## Data Privacy

- ✓ All reports generated locally on your device
- ✓ No data sent to external servers
- ✓ Reports stored in app's private directory
- ✓ You control when and what to share

## Updates & Changes

- Reports are generated fresh each time (not cached)
- Changing order data doesn't affect past reports
- Each report is a snapshot of data at generation time
- History logs are permanent records of what was generated
