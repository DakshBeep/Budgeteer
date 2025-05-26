# Railway Deployment Fixes

## Issues Identified and Fixed

### 1. **start.sh Permissions**
- **Issue**: The start.sh file was not executable (had -rw-r--r-- permissions)
- **Fix**: Added executable permissions with `chmod +x start.sh`
- **Also**: Updated start.sh to handle SQLite database path correctly

### 2. **Frontend API URL Configuration**
- **Issue**: Frontend was hardcoded to use VITE_API_BASE environment variable
- **Fix**: 
  - Created `frontend/src/utils/api.ts` to handle API URLs dynamically
  - Updated all components to use `buildApiUrl()` function
  - This allows the frontend to use relative paths when VITE_API_BASE is empty (production)

### 3. **SQLite Database Path**
- **Issue**: User had `DATABASE_URL=sqlite:///budgeteer.db` (relative path)
- **Fix**: Updated start.sh to convert relative SQLite paths to absolute paths in `/app/data/`

### 4. **Health Check**
- **Issue**: Health check might fail if PORT isn't set during startup
- **Fix**: Added fallback to port 8000 in Dockerfile health check

### 5. **Railway Configuration**
- **Added**: railway.json file with proper build and deploy configuration

## Environment Variables for Railway

The user should ensure these are set in Railway:

```
API_BASE=https://cashbff.com      # Not used by the app, can be removed
DATABASE_URL=sqlite:///budgeteer.db # Will be converted to absolute path
JWT_SECRET=supersecret             # Should be changed to something secure
PORT=<automatically set by Railway>
```

## Files Modified

1. **start.sh** - Made executable and added database path handling
2. **Dockerfile** - Fixed health check to use PORT with fallback
3. **railway.json** - Created for Railway-specific configuration
4. **frontend/src/utils/api.ts** - Created for API URL handling
5. **frontend/src/contexts/AuthContext.tsx** - Updated to use buildApiUrl
6. **frontend/src/components/TransactionModal.tsx** - Updated to use buildApiUrl
7. **frontend/src/pages/Dashboard.tsx** - Updated to use buildApiUrl
8. **frontend/src/pages/Transactions.tsx** - Updated to use buildApiUrl
9. **frontend/src/pages/Analytics.tsx** - Updated to use buildApiUrl
10. **frontend/src/pages/Insights.tsx** - Updated to use buildApiUrl
11. **frontend/src/components/PeerComparison.tsx** - Updated to use buildApiUrl
12. **frontend/src/components/DebugPanel.tsx** - Updated to show when using relative paths

## Deployment Steps

1. Commit all changes:
   ```bash
   git add .
   git commit -m "Fix Railway deployment issues"
   git push
   ```

2. In Railway:
   - Ensure the deployment uses the Dockerfile
   - Check that environment variables are set correctly
   - Monitor the deployment logs for any errors

## Notes

- The `API_BASE` environment variable the user has set is not used by the application
- The frontend will now work correctly with relative paths in production
- The SQLite database will be stored in `/app/data/budgeteer.db` in the container
- For production, consider switching to PostgreSQL for better performance and reliability