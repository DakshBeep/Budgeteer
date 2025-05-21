from typing import Optional
from datetime import date
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str

class Tx(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tx_date: date
    amount: float
    label: str
    notes: Optional[str] = None
    recurring: bool = False
    series_id: Optional[int] = Field(default=None, index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")

class BudgetGoal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    month: date
    amount: float
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
