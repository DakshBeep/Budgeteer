"""
Shared database configuration to avoid circular imports
"""
import os
from sqlmodel import create_engine

# Single source of truth for database configuration
DB_URL = os.getenv("DATABASE_URL", "sqlite:///budgeteer.db")
engine = create_engine(DB_URL, echo=False)