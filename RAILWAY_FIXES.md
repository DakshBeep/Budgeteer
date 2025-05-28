# Railway Deployment Issues and Fixes

## Critical Issues Found

### 1. **Missing User.email field**
- Location: `insights.py` line 449
- Error: `AttributeError: 'User' object has no attribute 'email'`
- Fix: Add email field to User model in `dbmodels.py`

### 2. **Wrong field names in peer_comparison.py**
- Location: Lines 45-48
- Error: `AttributeError: 'Tx' object has no attribute 'date'` and `'category'`
- Fix: Change `Tx.date` → `Tx.tx_date` and `Tx.category` → `Tx.label`

### 3. **Missing static directory**
- Location: `main.py` lines 122-183
- Error: Frontend files not found
- Fix: Add fallback to `frontend/dist` directory

### 4. **ML libraries may fail to install**
- Location: `Dockerfile` lines 34-36
- Issue: `|| true` hides installation failures
- Fix: Add proper error handling in code

### 5. **No JWT_SECRET validation**
- Location: Application startup
- Issue: App will crash if JWT_SECRET not set
- Fix: Add environment validation

## Quick Fixes to Apply

### Fix 1: Update dbmodels.py
```python
# Add after line 9 in dbmodels.py
    email: Optional[str] = Field(default=None, unique=True)
```

### Fix 2: Update peer_comparison.py
```python
# Replace lines 45-48
                        Tx.tx_date >= start_date,
                        Tx.tx_date <= end_date,
                        Tx.label == category,
```

### Fix 3: Update main.py for static directory
```python
# Add after line 121
if not os.path.exists(static_dir):
    alt_static_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
    if os.path.exists(alt_static_dir):
        static_dir = alt_static_dir
```

### Fix 4: Update forecast.py for optional ML libraries
```python
# Add at top of forecast.py
try:
    from catboost import CatBoostRegressor
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False

try:
    from neuralprophet import NeuralProphet
    NEURALPROPHET_AVAILABLE = True
except ImportError:
    NEURALPROPHET_AVAILABLE = False
```

### Fix 5: Add environment validation
```python
# In main.py, add after imports
if not os.getenv("JWT_SECRET"):
    raise ValueError("JWT_SECRET environment variable is required")
```

## Environment Variables for Railway

Set these in Railway dashboard:
- `JWT_SECRET` (required): Any secure random string
- `DATABASE_URL` (optional): PostgreSQL URL or leave empty for SQLite
- `ALLOWED_ORIGINS` (optional): Comma-separated list of allowed origins

## Verification Commands

After deployment, test these endpoints:
```bash
# Health check
curl https://your-app.railway.app/health

# Debug info
curl https://your-app.railway.app/debug

# API docs
curl https://your-app.railway.app/docs
```