from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
import logging
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

import os
from sqlmodel import create_engine

DB_URL = os.getenv("DATABASE_URL", "sqlite:///budgeteer.db")
engine = create_engine(DB_URL, echo=False)
from auth import router as auth_router
from transactions import router as tx_router
from forecast import router as forecast_router
import dbmodels
from datetime import date, timedelta
from dbmodels import User, Tx, BudgetGoal

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def init_db() -> None:
    SQLModel.metadata.create_all(engine)


app.include_router(auth_router)
app.include_router(tx_router)
app.include_router(forecast_router)
