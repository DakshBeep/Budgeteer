# Deploying Budgeteer to Vercel

This guide will help you deploy the Budgeteer application to Vercel and other services.

## Architecture Overview

Budgeteer consists of:
- **Frontend**: React + Vite app (can be deployed to Vercel)
- **Backend**: FastAPI Python app (needs a Python hosting service)
- **Database**: SQLite/PostgreSQL (needs a database service)

## Option 1: Frontend on Vercel + Backend on Render (Recommended)

### Step 1: Deploy Backend to Render.com

1. **Create a Render account** at https://render.com

2. **Create a new Web Service**:
   - Connect your GitHub repository
   - Choose the `budgeteer-backend` repo
   - Use these settings:
     ```
     Name: budgeteer-backend
     Environment: Python 3
     Build Command: pip install -r requirements.txt
     Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
     ```

3. **Add Environment Variables**:
   ```
   JWT_SECRET=your-secret-key-here
   DATABASE_URL=your-postgres-url (Render provides this)
   ```

4. **Create a PostgreSQL database** on Render and link it to your web service

5. **Note your backend URL**: `https://budgeteer-backend.onrender.com`

### Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Update frontend environment**:
   Create `frontend/.env.production`:
   ```
   VITE_API_BASE=https://budgeteer-backend.onrender.com
   ```

3. **Build settings for Vercel**:
   Create `frontend/vercel.json`:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [
       { "source": "/(.*)", "destination": "/" }
     ]
   }
   ```

4. **Deploy to Vercel**:
   ```bash
   cd frontend
   vercel
   ```

   Or via Vercel Dashboard:
   - Import your GitHub repository
   - Set root directory to `frontend`
   - Add environment variable: `VITE_API_BASE=https://budgeteer-backend.onrender.com`

## Option 2: Full Stack on Railway (Alternative)

Railway supports both Python and Node.js in the same project:

1. **Create a Railway account** at https://railway.app

2. **Create a new project** and connect your GitHub repo

3. **Add a PostgreSQL database** to your project

4. **Configure services**:
   - Backend service with Python buildpack
   - Frontend service with Node.js buildpack
   - Set environment variables

## Option 3: Frontend on Vercel + Backend on Fly.io

### Backend on Fly.io:

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create fly.toml** in root:
   ```toml
   app = "budgeteer-backend"
   primary_region = "sjc"

   [build]
     builder = "paketobuildpacks/builder:base"

   [env]
     PORT = "8080"

   [[services]]
     http_checks = []
     internal_port = 8080
     protocol = "tcp"
     script_checks = []

     [[services.ports]]
       force_https = true
       handlers = ["http"]
       port = 80

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```

3. **Deploy**:
   ```bash
   fly auth login
   fly launch
   fly secrets set JWT_SECRET=your-secret-key
   ```

### Frontend on Vercel:
Same as Option 1, Step 2

## Required Code Changes

### 1. Update CORS in backend (main.py):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-app.vercel.app",
        "http://localhost:5173"  # Keep for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Update API URL handling in frontend:
Create `frontend/src/config/api.ts`:
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
```

### 3. Database Migration:
For production, use PostgreSQL instead of SQLite:
```python
# In main.py or database.py
import os
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./budgeteer.db")
# If using Render/Railway PostgreSQL, it might need:
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
```

## Environment Variables Summary

### Backend (.env):
```
JWT_SECRET=your-secure-secret-key
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### Frontend (.env.production):
```
VITE_API_BASE=https://your-backend-url.com
```

## Post-Deployment Steps

1. **Run database migrations**:
   - The app will create tables on first run
   - Or SSH into your backend service and run migrations manually

2. **Test the deployment**:
   - Check frontend loads at `https://your-app.vercel.app`
   - Test login/registration
   - Verify API calls work (check browser console)

3. **Monitor logs**:
   - Vercel: Dashboard → Functions → Logs
   - Render: Dashboard → Logs
   - Railway: Dashboard → Deployments → Logs

## Troubleshooting

### CORS Issues:
- Ensure backend CORS settings include your Vercel URL
- Check browser console for specific CORS errors

### Database Connection:
- Verify DATABASE_URL is set correctly
- Check if database is accessible from backend service

### API Connection:
- Ensure VITE_API_BASE is set in Vercel environment
- Check network tab for failed requests
- Verify backend is running and accessible

### Build Failures:
- Check build logs in Vercel/Render dashboard
- Ensure all dependencies are in package.json/requirements.txt
- Verify Python version matches (3.8+)

## Cost Considerations

- **Vercel**: Free tier includes 100GB bandwidth/month
- **Render**: Free tier includes 750 hours/month (sleeps after 15 min inactivity)
- **Railway**: $5/month credit on free tier
- **Fly.io**: Free tier includes 3 shared VMs

For a production app with consistent traffic, expect ~$10-20/month total.