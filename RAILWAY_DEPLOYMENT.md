# Railway Deployment Guide for Budgeteer

This guide explains how to deploy the Budgeteer application to Railway with the unified Docker setup.

## What This Setup Does

- Builds the React frontend and serves it from the FastAPI backend
- Runs everything on a single Railway service (cost-effective!)
- Automatically handles routing between frontend and API
- Includes health checks and proper environment configuration

## Prerequisites

1. A Railway account (https://railway.app)
2. Railway CLI installed (optional but recommended)
3. PostgreSQL database on Railway

## Deployment Steps

### 1. Create a New Railway Project

```bash
railway login
railway init
```

### 2. Add PostgreSQL Database

In Railway dashboard:
- Click "New Service" → "Database" → "PostgreSQL"
- Railway will automatically set `DATABASE_URL`

### 3. Set Environment Variables

In Railway dashboard, add these variables:

```env
JWT_SECRET=<generate-a-secure-32-char-string>
ALLOWED_ORIGINS=https://<your-railway-domain>.railway.app
DATABASE_URL=${{RAILWAY_DATABASE_URL}}  # Auto-set if using Railway PostgreSQL
SMTP_HOST=smtp.gmail.com  # Optional: for email features
SMTP_PORT=587              # Optional
SMTP_USER=your-email       # Optional
SMTP_PASSWORD=your-pass    # Optional
```

**IMPORTANT**: Do NOT set the PORT variable - Railway sets this automatically!

### 4. Configure Start Command (IMPORTANT!)

In Railway service settings:
- **Start Command**: Leave empty (uses Dockerfile CMD)
- **OR if that doesn't work**: `./start.sh`
- **DO NOT USE**: `uvicorn main:app --port 8000` (wrong port!)

### 5. Deploy

#### Option A: Deploy from GitHub
1. Connect your GitHub repo to Railway
2. Railway will auto-deploy on every push

#### Option B: Deploy from CLI
```bash
railway up
```

### 5. Access Your App

Your app will be available at:
- `https://<your-service>.railway.app` - Frontend
- `https://<your-service>.railway.app/docs` - API Documentation

## Architecture on Railway

```
┌─────────────────────────────────┐
│         Railway Service         │
│                                 │
│  ┌──────────────────────────┐  │
│  │   FastAPI Backend (8000)  │  │
│  │                          │  │
│  │  - API Routes (/api/*)   │  │
│  │  - Static Files Server   │  │
│  │  - React App (/)         │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │   PostgreSQL Database    │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

## How It Works

1. **Multi-stage Docker Build**:
   - Stage 1: Builds React app with Vite
   - Stage 2: Sets up Python environment and copies built frontend

2. **Unified Routing**:
   - `/health` - Health check endpoint
   - `/docs` - API documentation
   - `/api/*`, `/auth/*`, etc. - API endpoints
   - `/` - React app
   - `/*` - React Router catch-all

3. **Environment Variables**:
   - `PORT` - Automatically set by Railway
   - `DATABASE_URL` - Automatically set when using Railway PostgreSQL
   - `JWT_SECRET` - You must set this
   - `RAILWAY_STATIC_URL` - Automatically set by Railway

## Monitoring

Railway provides:
- Automatic health checks every 30 seconds
- Deployment logs
- Resource usage metrics
- Automatic restarts on failure

## Troubleshooting

### Build Fails
- Check Railway build logs
- Ensure all dependencies are in `requirements.txt` and `package.json`

### App Crashes
- Check runtime logs: `railway logs`
- Verify environment variables are set
- Check database connection

### Frontend 404 Errors
- The catch-all route handles React Router
- API routes take precedence over static files

### Database Issues
- Ensure `DATABASE_URL` is set
- Check if tables are created (they auto-create on startup)

## Cost Optimization

This setup minimizes costs by:
- Running frontend and backend in one service
- Using Railway's PostgreSQL (cheaper than external)
- Efficient caching in Docker layers
- Health checks prevent unnecessary restarts

## Local Testing

Test the production build locally:

```bash
docker build -t budgeteer .
docker run -p 8000:8000 \
  -e JWT_SECRET=test-secret \
  -e DATABASE_URL=sqlite:///./budgeteer.db \
  budgeteer
```

Visit http://localhost:8000 to see your app!

## Security Notes

1. Always use HTTPS (Railway provides this)
2. Set strong `JWT_SECRET`
3. Configure `ALLOWED_ORIGINS` properly
4. Use PostgreSQL in production (not SQLite)
5. Enable email features only with secure SMTP

## Next Steps

After deployment:
1. Test all features
2. Set up custom domain (optional)
3. Configure email settings (optional)
4. Monitor logs and metrics
5. Set up CI/CD with GitHub Actions