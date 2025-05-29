"""
Minimal FastAPI app for Railway deployment
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import SQLModel
import logging
import os
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

# Validate required environment variables
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    logger.error("JWT_SECRET environment variable is required!")
    # Set a default for Railway deployment
    JWT_SECRET = os.urandom(32).hex()
    os.environ["JWT_SECRET"] = JWT_SECRET
    logger.warning(f"Generated temporary JWT_SECRET: {JWT_SECRET[:8]}...")

# Import after env vars are set
from database import engine
from auth import router as auth_router
from transactions import router as transactions_router
from forecast import router as forecast_router
from recurring import router as recurring_router

# Create FastAPI app
app = FastAPI(
    title="CashBFF API",
    version="1.0.0",
    description="Budget tracking API for students"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(transactions_router, tags=["transactions"])
app.include_router(forecast_router, tags=["forecast"])
app.include_router(recurring_router, prefix="/recurring", tags=["recurring"])

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Creating database tables...")
    SQLModel.metadata.create_all(engine)
    logger.info("Database initialized successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

# Serve static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    # Mount assets directory
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        logger.info(f"Mounted assets directory: {assets_dir}")
    
    # Serve index.html for root and all unmatched routes
    @app.get("/")
    async def serve_root():
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "CashBFF API", "docs": "/docs", "health": "/health"}
    
    # Catch-all route for React Router
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't catch API routes
        if full_path.startswith("api/") or full_path in ["docs", "openapi.json", "health"]:
            raise HTTPException(status_code=404, detail="Not found")
        
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Not found")
else:
    logger.warning(f"Static directory not found: {static_dir}")
    
    @app.get("/")
    async def root():
        """Root endpoint when no static files"""
        return {
            "message": "CashBFF API",
            "docs": "/docs",
            "health": "/health",
            "version": "1.0.0"
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)