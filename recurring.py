"""
Recurring expenses API endpoints
"""
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, and_, or_
from pydantic import BaseModel
from database import engine
from auth import get_current_user
from dbmodels import User, Tx
import pandas as pd

router = APIRouter(prefix="/recurring", tags=["recurring"])

class RecurringExpenseResponse(BaseModel):
    id: int
    name: str
    amount: float
    category: str
    frequency: str
    next_date: str
    is_active: bool
    reminder_days: int
    notes: Optional[str]
    series_id: int

class RecurringStats(BaseModel):
    total_monthly: float
    total_yearly: float
    active_count: int
    paused_count: int
    upcoming_week: List[RecurringExpenseResponse]
    by_category: Dict[str, float]

def get_frequency_from_series(transactions: List[Tx]) -> str:
    """Determine frequency from transaction series"""
    if len(transactions) < 2:
        return "monthly"  # Default
    
    # Calculate average days between transactions
    sorted_txs = sorted(transactions, key=lambda x: x.tx_date)
    total_days = 0
    count = 0
    
    for i in range(1, len(sorted_txs)):
        days_diff = (sorted_txs[i].tx_date - sorted_txs[i-1].tx_date).days
        if days_diff > 0:  # Ignore same-day transactions
            total_days += days_diff
            count += 1
    
    if count == 0:
        return "monthly"
    
    avg_days = total_days / count
    
    # Determine frequency based on average days
    if avg_days <= 1.5:
        return "daily"
    elif avg_days <= 10:
        return "weekly"
    elif avg_days <= 20:
        return "biweekly"
    elif avg_days <= 45:
        return "monthly"
    elif avg_days <= 120:
        return "quarterly"
    else:
        return "yearly"

@router.get("/expenses", response_model=List[RecurringExpenseResponse])
def get_recurring_expenses(
    user: User = Depends(get_current_user)
):
    """Get all recurring expenses for the user"""
    with Session(engine) as session:
        # Get all recurring transactions grouped by series_id
        recurring_txs = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.recurring == True,
                Tx.series_id != None
            ).order_by(Tx.series_id, Tx.tx_date)
        ).all()
        
        # Group by series_id
        series_map = {}
        for tx in recurring_txs:
            if tx.series_id not in series_map:
                series_map[tx.series_id] = []
            series_map[tx.series_id].append(tx)
        
        expenses = []
        today = date.today()
        
        for series_id, txs in series_map.items():
            if not txs:
                continue
            
            # Get the most recent transaction for details
            latest_tx = max(txs, key=lambda x: x.tx_date)
            
            # Find next upcoming transaction
            future_txs = [tx for tx in txs if tx.tx_date >= today]
            next_tx = min(future_txs, key=lambda x: x.tx_date) if future_txs else None
            
            # Determine if series is active (has future transactions)
            is_active = len(future_txs) > 0
            
            # Use notes from latest transaction or generate name from label
            name = latest_tx.notes if latest_tx.notes else latest_tx.label
            
            expenses.append(RecurringExpenseResponse(
                id=series_id,  # Use series_id as the expense ID
                name=name,
                amount=abs(latest_tx.amount),  # Make positive for display
                category=latest_tx.label.lower().replace(" & ", "").replace(" ", ""),
                frequency=get_frequency_from_series(txs),
                next_date=next_tx.tx_date.isoformat() if next_tx else latest_tx.tx_date.isoformat(),
                is_active=is_active,
                reminder_days=3,  # Default reminder
                notes=latest_tx.notes,
                series_id=series_id
            ))
        
        return expenses

@router.get("/stats", response_model=RecurringStats)
def get_recurring_stats(
    user: User = Depends(get_current_user)
):
    """Get recurring expense statistics"""
    expenses = get_recurring_expenses(user)
    
    # Calculate monthly amounts based on frequency
    def to_monthly(expense: RecurringExpenseResponse) -> float:
        if not expense.is_active:
            return 0
        amount = expense.amount
        if expense.frequency == "daily":
            return amount * 30
        elif expense.frequency == "weekly":
            return amount * 4.33
        elif expense.frequency == "biweekly":
            return amount * 2.17
        elif expense.frequency == "monthly":
            return amount
        elif expense.frequency == "quarterly":
            return amount / 3
        elif expense.frequency == "yearly":
            return amount / 12
        return amount
    
    active_expenses = [e for e in expenses if e.is_active]
    total_monthly = sum(to_monthly(e) for e in active_expenses)
    
    # Get upcoming week expenses
    today = date.today()
    week_from_now = today + timedelta(days=7)
    upcoming = [
        e for e in active_expenses 
        if today <= date.fromisoformat(e.next_date) <= week_from_now
    ]
    
    # Calculate by category
    by_category = {}
    for expense in active_expenses:
        monthly_amount = to_monthly(expense)
        if expense.category in by_category:
            by_category[expense.category] += monthly_amount
        else:
            by_category[expense.category] = monthly_amount
    
    return RecurringStats(
        total_monthly=total_monthly,
        total_yearly=total_monthly * 12,
        active_count=len(active_expenses),
        paused_count=len(expenses) - len(active_expenses),
        upcoming_week=upcoming,
        by_category=by_category
    )

@router.patch("/expenses/{series_id}/toggle")
def toggle_recurring_expense(
    series_id: int,
    user: User = Depends(get_current_user)
):
    """Toggle a recurring expense series on/off"""
    with Session(engine) as session:
        # Get all transactions in this series
        txs = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.series_id == series_id
            )
        ).all()
        
        if not txs:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        today = date.today()
        
        # Toggle by deleting or creating future transactions
        future_txs = [tx for tx in txs if tx.tx_date > today]
        
        if future_txs:
            # Currently active - deactivate by removing future transactions
            for tx in future_txs:
                session.delete(tx)
        else:
            # Currently inactive - reactivate by creating future transactions
            latest_tx = max(txs, key=lambda x: x.tx_date)
            last_date = latest_tx.tx_date
            
            # Create 3 months of future transactions
            for i in range(3):
                last_date = (pd.Timestamp(last_date) + pd.DateOffset(months=1)).date()
                new_tx = Tx(
                    tx_date=last_date,
                    amount=latest_tx.amount,
                    label=latest_tx.label,
                    notes=latest_tx.notes,
                    recurring=True,
                    series_id=series_id,
                    user_id=user.id
                )
                session.add(new_tx)
        
        session.commit()
        return {"status": "toggled"}

@router.delete("/expenses/{series_id}")
def delete_recurring_expense(
    series_id: int,
    user: User = Depends(get_current_user)
):
    """Delete all transactions in a recurring series"""
    with Session(engine) as session:
        # Get all transactions in this series
        txs = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.series_id == series_id
            )
        ).all()
        
        if not txs:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        # Delete all transactions in the series
        for tx in txs:
            session.delete(tx)
        
        session.commit()
        return {"status": "deleted", "count": len(txs)}