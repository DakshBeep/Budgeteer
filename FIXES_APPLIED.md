# Railway Deployment Fixes Applied

## Summary of Changes

### 1. ✅ Added email field to User model
- **File**: `dbmodels.py`
- **Change**: Added `email: Optional[str] = Field(default=None, unique=True)` to User class
- **Reason**: insights.py was trying to access user.email which didn't exist

### 2. ✅ Fixed field names in peer_comparison.py
- **File**: `peer_comparison.py`
- **Changes**:
  - `Tx.date` → `Tx.tx_date` (lines 46, 47, 127, 128)
  - `Tx.category` → `Tx.label` (lines 48, 123, 130)
  - `SpendingBenchmark.demographic` → `SpendingBenchmark.user_demographic`
  - Removed references to non-existent `period` field
- **Reason**: Using wrong field names that don't exist in the models

### 3. ✅ Added static directory fallback
- **File**: `main.py`
- **Change**: Added fallback to check `frontend/dist` if `static` directory doesn't exist
- **Reason**: Docker builds create `static` but local dev uses `frontend/dist`

### 4. ✅ Added JWT_SECRET validation
- **File**: `main.py`
- **Change**: Added check for JWT_SECRET environment variable at startup
- **Reason**: App would crash later without this required variable

### 5. ✅ Added ML library error handling
- **File**: `forecast.py`
- **Change**: Added checks for ML_AVAILABLE before using catboost/neuralprophet
- **Reason**: If ML libraries fail to install, provide clear error messages

### 6. ✅ Updated SpendingBenchmark model
- **File**: `dbmodels.py`
- **Change**: Added `benchmark_data: dict` field to store detailed benchmark data
- **Reason**: peer_comparison.py was using this field that didn't exist

### 7. ✅ Fixed benchmark data handling
- **File**: `peer_comparison.py`
- **Change**: Now properly sets benchmark_data field when creating/updating benchmarks
- **Reason**: Complete the fix for SpendingBenchmark usage

## Remaining Tasks

### Database Migration Required
Since we added new fields to models, you'll need to either:
1. Delete the existing database and let it recreate
2. Or add these fields manually:
```sql
ALTER TABLE user ADD COLUMN email VARCHAR UNIQUE;
ALTER TABLE spendingbenchmark ADD COLUMN benchmark_data JSON;
```

### Environment Variables for Railway
Set these in your Railway dashboard:
- `JWT_SECRET`: Any secure random string (required)
- `DATABASE_URL`: PostgreSQL connection string (optional, defaults to SQLite)
- `ALLOWED_ORIGINS`: Your frontend URL (optional)

### Build Frontend
Before deploying, ensure frontend is built:
```bash
cd frontend
npm install
npm run build
```

## Testing Commands

After deployment, test these endpoints:
```bash
# Health check - should return {"status":"healthy","service":"budgeteer-api"}
curl https://your-app.railway.app/health

# Debug info - shows configuration details
curl https://your-app.railway.app/debug

# API docs - should show FastAPI documentation
curl https://your-app.railway.app/docs
```

## Next Steps

1. Commit these changes: `git add -A && git commit -m "Fix Railway deployment issues"`
2. Push to your repository: `git push`
3. Railway should automatically redeploy
4. Monitor the deployment logs for any errors
5. Test the endpoints above once deployed