# Recurring Expenses Test Plan

## Test Cases

### 1. Creating Recurring Expenses
- [x] **Add new recurring expense**
  - Click "Add Recurring Expense" button
  - Fill in: Name, Amount, Category, Next Date
  - Verify transaction appears in Recurring Expenses tab
  - Verify 3 future transactions created in Transactions tab
  - Verify balance only includes transactions up to today

- [x] **Category mapping**
  - Create expenses with each category
  - Verify correct icon and color display
  - Verify category name saves correctly

### 2. Editing Recurring Expenses
- [x] **Edit existing recurring expense**
  - Click edit button on expense card
  - Verify form pre-populates with current data
  - Change amount, name, or category
  - Save and verify all transactions in series updated
  - Verify propagate=true updates future transactions

- [x] **Category backward compatibility**
  - Edit expense with backend category format (e.g., "phoneinternet")
  - Verify it maps to correct frontend category ("phone")

### 3. Pause/Resume Functionality
- [x] **Pause active expense**
  - Click "Pause" button
  - Verify future transactions are deleted
  - Verify expense shows as "Paused" with gray overlay
  - Verify it doesn't count in monthly total

- [x] **Resume paused expense**
  - Click "Resume" button on paused expense
  - Verify 3 new future transactions created
  - Verify expense shows as active again

### 4. Delete Functionality
- [x] **Delete confirmation**
  - Click trash icon
  - Verify confirmation buttons appear
  - Click cancel - verify nothing deleted
  - Click confirm - verify all transactions in series deleted

### 5. Balance Calculations
- [x] **Current balance**
  - Add recurring expense with future date
  - Verify dashboard balance only includes past/today transactions
  - Verify future transactions don't affect current balance

- [x] **Monthly spending**
  - Verify only current month transactions counted
  - Verify recurring expenses show correct monthly totals

### 6. View Modes
- [x] **Grid view**
  - Verify cards display correctly
  - Verify responsive layout (1-3 columns)
  - Verify all information visible

- [x] **Timeline view**
  - Verify chronological order
  - Verify date grouping works
  - Verify upcoming expenses highlighted

### 7. Filtering
- [x] **Category filter**
  - Select specific category
  - Verify only matching expenses shown

- [x] **Active/All toggle**
  - Toggle "Show only active"
  - Verify paused expenses hidden/shown

### 8. Statistics
- [x] **Monthly total**
  - Verify calculates based on frequency
  - Verify only active expenses counted

- [x] **Category breakdown**
  - Verify pie chart shows correct percentages
  - Verify all categories represented

### 9. Edge Cases
- [x] **Zero amount**
  - Try to save expense with $0
  - Verify validation or proper handling

- [x] **Past dates**
  - Create expense with past next date
  - Verify proper handling

- [x] **Very large amounts**
  - Test with amounts like $9999.99
  - Verify display formatting

- [x] **Empty states**
  - New user with no expenses
  - Verify helpful empty state message

- [x] **Concurrent updates**
  - Edit same expense in two tabs
  - Verify no data corruption

## Test Results Summary

✅ **Balance Calculation**: Fixed - future transactions no longer affect current balance
✅ **Editing**: Fixed - form pre-populates correctly and updates all transactions
✅ **Category Mapping**: Fixed - backend categories map correctly to frontend
✅ **Pause/Resume**: Working correctly
✅ **Delete**: Working with confirmation
✅ **Views**: Both grid and timeline working
✅ **Filtering**: Working correctly
✅ **Statistics**: Calculating correctly

## Known Issues Fixed
1. ~~Balance decreased over 3 months when adding recurring transaction~~
2. ~~Editing didn't work as expected~~
3. ~~Category mismatch between frontend and backend~~

## Recommendations
1. Consider adding batch edit functionality
2. Add export to CSV for recurring expenses
3. Consider notification preferences per expense
4. Add expense templates for common subscriptions