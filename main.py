from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import SQLModel
import logging
import os
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    def load_dotenv(path: str = ".env"):
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    if line.strip() and not line.startswith("#") and "=" in line:
                        k, v = line.strip().split("=", 1)
                        os.environ.setdefault(k, v)

from database import engine
from auth import router as auth_router
from transactions import router as tx_router
from forecast import router as forecast_router
from analytics import router as analytics_router
from insights import router as insights_router
import dbmodels
from datetime import date, timedelta
from dbmodels import User, Tx, BudgetGoal

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="CashBFF API", version="1.0.0")

# Get allowed origins from environment or use defaults
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:8501").split(",")

# Handle various environment variable names for Railway
API_BASE = os.getenv("API_BASE")
if API_BASE:
    ALLOWED_ORIGINS.append(API_BASE)
    # Add both http and https versions
    if API_BASE.startswith("https://"):
        ALLOWED_ORIGINS.append(API_BASE.replace("https://", "http://"))
    elif API_BASE.startswith("http://"):
        ALLOWED_ORIGINS.append(API_BASE.replace("http://", "https://"))

# Add Railway's domain if RAILWAY_STATIC_URL is set
RAILWAY_URL = os.getenv("RAILWAY_STATIC_URL")
if RAILWAY_URL:
    ALLOWED_ORIGINS.append(f"https://{RAILWAY_URL}")
    ALLOWED_ORIGINS.append(f"http://{RAILWAY_URL}")

# Add the actual deployment URL if provided
RAILWAY_PUBLIC_DOMAIN = os.getenv("RAILWAY_PUBLIC_DOMAIN")
if RAILWAY_PUBLIC_DOMAIN:
    ALLOWED_ORIGINS.append(f"https://{RAILWAY_PUBLIC_DOMAIN}")
    ALLOWED_ORIGINS.append(f"http://{RAILWAY_PUBLIC_DOMAIN}")

# Log the allowed origins for debugging
logging.info(f"Allowed CORS origins: {ALLOWED_ORIGINS}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint (must be before static file mounting)
@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    return {"status": "healthy", "service": "budgeteer-api"}

# Debug endpoint to check deployment
@app.get("/debug")
async def debug_info():
    """Debug endpoint to check deployment status"""
    import sys
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    return {
        "status": "running",
        "python_version": sys.version,
        "static_dir": static_dir,
        "static_exists": os.path.exists(static_dir),
        "static_contents": os.listdir(static_dir) if os.path.exists(static_dir) else [],
        "cwd": os.getcwd(),
        "env_vars": {
            "PORT": os.getenv("PORT"),
            "DATABASE_URL": os.getenv("DATABASE_URL"),
            "API_BASE": os.getenv("API_BASE"),
            "RAILWAY_STATIC_URL": os.getenv("RAILWAY_STATIC_URL"),
            "RAILWAY_PUBLIC_DOMAIN": os.getenv("RAILWAY_PUBLIC_DOMAIN")
        }
    }

# API routes must be included before static file handling
app.include_router(auth_router)
app.include_router(tx_router)
app.include_router(forecast_router)
app.include_router(analytics_router)
app.include_router(insights_router)

# Import and include budgets router
from budgets import router as budgets_router
app.include_router(budgets_router)

@app.on_event("startup")
async def startup_event() -> None:
    SQLModel.metadata.create_all(engine)
    # Start the insight scheduler
    from scheduler import start_scheduler
    await start_scheduler()
    logging.info("Started insight scheduler")

# Serve React static files (must be after API routes)
static_dir = os.path.join(os.path.dirname(__file__), "static")
logging.info(f"Looking for static files in: {static_dir}")
logging.info(f"Static directory exists: {os.path.exists(static_dir)}")

if os.path.exists(static_dir):
    # Check if assets directory exists
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        logging.info(f"Mounted assets directory: {assets_dir}")
    else:
        logging.warning(f"Assets directory not found: {assets_dir}")
    
    # Check if index.html exists
    index_path = os.path.join(static_dir, "index.html")
    if not os.path.exists(index_path):
        logging.error(f"index.html not found at: {index_path}")
    else:
        logging.info(f"Found index.html at: {index_path}")
    
    # Serve index.html for the root path
    @app.get("/")
    async def serve_root():
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            return {"error": "Frontend not built", "message": "Run npm run build in frontend directory"}
    
    # Catch-all route for React Router (must be last)
    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        """Serve React app for all non-API routes"""
        # Skip API routes and docs
        if (full_path.startswith("api/") or 
            full_path.startswith("auth/") or
            full_path.startswith("tx") or
            full_path.startswith("goal") or
            full_path.startswith("forecast") or
            full_path.startswith("analytics") or
            full_path.startswith("insights") or
            full_path in ["docs", "redoc", "openapi.json", "health"]):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Check if it's a static file request
        file_path = os.path.join(static_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # For all other routes, serve the React app
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")
else:
    logging.warning(f"Static directory not found: {static_dir}")
    @app.get("/")
    async def root():
        """Root endpoint when no static files are present"""
        return {"message": "Budgeteer API", "docs": "/docs", "static_dir": static_dir, "exists": os.path.exists(static_dir)}
