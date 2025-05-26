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

app = FastAPI(title="Budgeteer API", version="1.0.0")

# Get allowed origins from environment or use defaults
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:8501").split(",")

# Add Railway's domain if RAILWAY_STATIC_URL is set
RAILWAY_URL = os.getenv("RAILWAY_STATIC_URL")
if RAILWAY_URL:
    ALLOWED_ORIGINS.append(f"https://{RAILWAY_URL}")
    ALLOWED_ORIGINS.append(f"http://{RAILWAY_URL}")

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

# API routes must be included before static file handling
app.include_router(auth_router)
app.include_router(tx_router)
app.include_router(forecast_router)
app.include_router(analytics_router)
app.include_router(insights_router)

@app.on_event("startup")
async def startup_event() -> None:
    SQLModel.metadata.create_all(engine)
    # Start the insight scheduler
    from scheduler import start_scheduler
    await start_scheduler()
    logging.info("Started insight scheduler")

# Serve React static files (must be after API routes)
if os.path.exists("static"):
    # Mount static files directory
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
    
    # Serve index.html for the root path
    @app.get("/")
    async def serve_root():
        return FileResponse("static/index.html")
    
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
        file_path = os.path.join("static", full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # For all other routes, serve the React app
        return FileResponse("static/index.html")
else:
    @app.get("/")
    async def root():
        """Root endpoint when no static files are present"""
        return {"message": "Budgeteer API", "docs": "/docs"}
