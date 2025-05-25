from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from datetime import date, datetime, timedelta
from typing import Literal, List, Dict, Optional, Any
from calendar import monthrange
import json

import main
from auth import get_current_user
from dbmodels import User, Tx

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/summary")
def get_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get overall financial summary for date range"""
    with Session(main.engine) as session:
        # Get all transactions in date range
        transactions = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date
            )
        ).all()
        
        total_income = sum(tx.amount for tx in transactions if tx.amount > 0)
        total_expenses = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)
        net_savings = total_income - total_expenses
        
        # Calculate daily average
        days_in_range = (end_date - start_date).days + 1
        avg_daily_spending = total_expenses / days_in_range if days_in_range > 0 else 0
        
        # Find largest expense category
        expense_by_category = {}
        for tx in transactions:
            if tx.amount < 0:
                expense_by_category[tx.label] = expense_by_category.get(tx.label, 0) + abs(tx.amount)
        
        largest_category = max(expense_by_category.items(), key=lambda x: x[1])[0] if expense_by_category else None
        
        return {
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "net_savings": round(net_savings, 2),
            "avg_daily_spending": round(avg_daily_spending, 2),
            "largest_expense_category": largest_category,
            "transaction_count": len(transactions),
            "days_in_range": days_in_range
        }

@router.get("/category-breakdown")
def get_category_breakdown(
    start_date: date = Query(...),
    end_date: date = Query(...),
    type: Literal["income", "expense", "all"] = Query("all"),
    user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get spending breakdown by category"""
    with Session(main.engine) as session:
        transactions = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date
            )
        ).all()
        
        category_totals = {}
        for tx in transactions:
            if type == "income" and tx.amount <= 0:
                continue
            elif type == "expense" and tx.amount >= 0:
                continue
                
            amount = abs(tx.amount)
            category_totals[tx.label] = category_totals.get(tx.label, 0) + amount
        
        total = sum(category_totals.values())
        
        return [
            {
                "category": category,
                "amount": round(amount, 2),
                "percentage": round((amount / total * 100), 1) if total > 0 else 0,
                "type": "income" if type == "income" else "expense"
            }
            for category, amount in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
        ]

@router.get("/trends")
def get_trends(
    start_date: date = Query(...),
    end_date: date = Query(...),
    interval: Literal["daily", "weekly", "monthly"] = Query("daily"),
    user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get income/expense trends over time"""
    with Session(main.engine) as session:
        transactions = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date
            ).order_by(Tx.tx_date)
        ).all()
        
        # Group transactions by interval
        grouped_data = {}
        for tx in transactions:
            if interval == "daily":
                key = tx.tx_date.isoformat()
            elif interval == "weekly":
                # Get start of week
                week_start = tx.tx_date - timedelta(days=tx.tx_date.weekday())
                key = week_start.isoformat()
            else:  # monthly
                key = f"{tx.tx_date.year}-{tx.tx_date.month:02d}"
            
            if key not in grouped_data:
                grouped_data[key] = {"income": 0, "expenses": 0}
            
            if tx.amount > 0:
                grouped_data[key]["income"] += tx.amount
            else:
                grouped_data[key]["expenses"] += abs(tx.amount)
        
        # Fill in missing dates
        result = []
        current = start_date
        while current <= end_date:
            if interval == "daily":
                key = current.isoformat()
                next_date = current + timedelta(days=1)
            elif interval == "weekly":
                week_start = current - timedelta(days=current.weekday())
                key = week_start.isoformat()
                next_date = current + timedelta(days=7)
            else:  # monthly
                key = f"{current.year}-{current.month:02d}"
                if current.month == 12:
                    next_date = date(current.year + 1, 1, 1)
                else:
                    next_date = date(current.year, current.month + 1, 1)
            
            data = grouped_data.get(key, {"income": 0, "expenses": 0})
            result.append({
                "date": key,
                "income": round(data["income"], 2),
                "expenses": round(data["expenses"], 2),
                "net": round(data["income"] - data["expenses"], 2)
            })
            
            current = next_date
            if interval != "daily" and current > end_date:
                break
        
        return result

@router.get("/comparison")
def get_comparison(
    current_start: date = Query(...),
    current_end: date = Query(...),
    previous_start: date = Query(...),
    previous_end: date = Query(...),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Compare two time periods"""
    with Session(main.engine) as session:
        # Get current period data
        current_txs = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= current_start,
                Tx.tx_date <= current_end
            )
        ).all()
        
        # Get previous period data
        previous_txs = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= previous_start,
                Tx.tx_date <= previous_end
            )
        ).all()
        
        def calculate_metrics(transactions):
            income = sum(tx.amount for tx in transactions if tx.amount > 0)
            expenses = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)
            return {
                "income": round(income, 2),
                "expenses": round(expenses, 2),
                "net": round(income - expenses, 2),
                "transaction_count": len(transactions)
            }
        
        current_metrics = calculate_metrics(current_txs)
        previous_metrics = calculate_metrics(previous_txs)
        
        # Calculate percentage changes
        def calc_change(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round((current - previous) / previous * 100, 1)
        
        return {
            "current_period": current_metrics,
            "previous_period": previous_metrics,
            "changes": {
                "income": calc_change(current_metrics["income"], previous_metrics["income"]),
                "expenses": calc_change(current_metrics["expenses"], previous_metrics["expenses"]),
                "net": calc_change(current_metrics["net"], previous_metrics["net"]),
                "transaction_count": calc_change(current_metrics["transaction_count"], previous_metrics["transaction_count"])
            }
        }

@router.get("/patterns")
def get_patterns(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Analyze spending patterns"""
    with Session(main.engine) as session:
        transactions = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date,
                Tx.amount < 0  # Only expenses
            )
        ).all()
        
        # Day of week analysis
        dow_spending = {i: 0 for i in range(7)}
        dow_count = {i: 0 for i in range(7)}
        
        # Time of month analysis (beginning, middle, end)
        month_segments = {"beginning": 0, "middle": 0, "end": 0}
        segment_counts = {"beginning": 0, "middle": 0, "end": 0}
        
        for tx in transactions:
            # Day of week
            dow = tx.tx_date.weekday()
            dow_spending[dow] += abs(tx.amount)
            dow_count[dow] += 1
            
            # Time of month
            day = tx.tx_date.day
            days_in_month = monthrange(tx.tx_date.year, tx.tx_date.month)[1]
            if day <= 10:
                segment = "beginning"
            elif day <= 20:
                segment = "middle"
            else:
                segment = "end"
            
            month_segments[segment] += abs(tx.amount)
            segment_counts[segment] += 1
        
        # Calculate averages
        dow_labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        dow_analysis = [
            {
                "day": dow_labels[i],
                "average_spending": round(dow_spending[i] / dow_count[i], 2) if dow_count[i] > 0 else 0,
                "total_spending": round(dow_spending[i], 2),
                "transaction_count": dow_count[i]
            }
            for i in range(7)
        ]
        
        month_analysis = [
            {
                "segment": segment,
                "average_spending": round(month_segments[segment] / segment_counts[segment], 2) if segment_counts[segment] > 0 else 0,
                "total_spending": round(month_segments[segment], 2),
                "transaction_count": segment_counts[segment]
            }
            for segment in ["beginning", "middle", "end"]
        ]
        
        # Find peak spending day
        peak_day_idx = max(range(7), key=lambda i: dow_spending[i])
        peak_day = dow_labels[peak_day_idx]
        
        return {
            "day_of_week_analysis": dow_analysis,
            "month_segment_analysis": month_analysis,
            "peak_spending_day": peak_day,
            "recurring_transactions": len([tx for tx in transactions if tx.recurring])
        }

@router.get("/budget-performance")
def get_budget_performance(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get budget vs actual performance over time"""
    with Session(main.engine) as session:
        # Get all budget goals in the date range
        from dbmodels import BudgetGoal
        
        result = []
        current = start_date
        
        while current <= end_date:
            month_start = date(current.year, current.month, 1)
            days_in_month = monthrange(current.year, current.month)[1]
            month_end = date(current.year, current.month, days_in_month)
            
            # Get budget for this month
            budget = session.exec(
                select(BudgetGoal).where(
                    BudgetGoal.user_id == user.id,
                    BudgetGoal.month == month_start
                )
            ).first()
            
            # Get actual spending for this month
            transactions = session.exec(
                select(Tx).where(
                    Tx.user_id == user.id,
                    Tx.tx_date >= month_start,
                    Tx.tx_date <= month_end,
                    Tx.amount < 0
                )
            ).all()
            
            actual_spending = sum(abs(tx.amount) for tx in transactions)
            budget_amount = budget.amount if budget else 0
            
            result.append({
                "month": month_start.strftime("%Y-%m"),
                "budget": round(budget_amount, 2),
                "actual": round(actual_spending, 2),
                "remaining": round(budget_amount - actual_spending, 2) if budget else None,
                "percentage_used": round((actual_spending / budget_amount * 100), 1) if budget and budget_amount > 0 else None
            })
            
            # Move to next month
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
            
            if current > end_date:
                break
        
        return result

@router.get("/cashflow")
def get_cashflow(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get cash flow analysis"""
    with Session(main.engine) as session:
        transactions = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date
            ).order_by(Tx.tx_date)
        ).all()
        
        # Calculate running balance
        running_balance = 0
        daily_balances = {}
        cashflow_data = []
        
        # Group by date and calculate daily totals
        for tx in transactions:
            date_key = tx.tx_date.isoformat()
            if date_key not in daily_balances:
                daily_balances[date_key] = {"income": 0, "expenses": 0}
            
            if tx.amount > 0:
                daily_balances[date_key]["income"] += tx.amount
            else:
                daily_balances[date_key]["expenses"] += abs(tx.amount)
        
        # Create cashflow waterfall data
        current = start_date
        while current <= end_date:
            date_key = current.isoformat()
            if date_key in daily_balances:
                income = daily_balances[date_key]["income"]
                expenses = daily_balances[date_key]["expenses"]
                net = income - expenses
                running_balance += net
                
                cashflow_data.append({
                    "date": date_key,
                    "income": round(income, 2),
                    "expenses": round(expenses, 2),
                    "net": round(net, 2),
                    "balance": round(running_balance, 2)
                })
            
            current += timedelta(days=1)
        
        # Calculate summary metrics
        total_income = sum(d.get("income", 0) for d in cashflow_data)
        total_expenses = sum(d.get("expenses", 0) for d in cashflow_data)
        
        return {
            "cashflow_data": cashflow_data,
            "summary": {
                "total_income": round(total_income, 2),
                "total_expenses": round(total_expenses, 2),
                "net_cashflow": round(total_income - total_expenses, 2),
                "ending_balance": round(running_balance, 2),
                "positive_days": len([d for d in cashflow_data if d["net"] > 0]),
                "negative_days": len([d for d in cashflow_data if d["net"] < 0])
            }
        }