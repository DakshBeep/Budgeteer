"""
Budget management API endpoints
"""
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from pydantic import BaseModel
from database import engine
from auth import get_current_user
from dbmodels import (
    User, Tx, CategoryBudget, BudgetAlert, SavingsGoal, Bill,
    BudgetPeriod, BudgetTemplate, BudgetGoal
)

router = APIRouter()

# Budget Templates
BUDGET_TEMPLATES = {
    "broke_student": {
        "name": "Broke College Student",
        "description": "Tight budget for students with minimal income",
        "monthly_total": 800,
        "categories": {
            "Food": 200,
            "Transport": 50,
            "Shopping": 50,
            "Entertainment": 30,
            "Bills": 150,
            "Healthcare": 20,
            "Education": 200,
            "Personal": 50,
            "Other": 50
        }
    },
    "first_job": {
        "name": "First Job Graduate",
        "description": "Entry-level professional budget",
        "monthly_total": 3000,
        "categories": {
            "Food": 400,
            "Transport": 200,
            "Shopping": 200,
            "Entertainment": 150,
            "Bills": 1200,
            "Healthcare": 100,
            "Education": 100,
            "Personal": 150,
            "Savings": 400,
            "Other": 100
        }
    },
    "grad_student": {
        "name": "Graduate Student",
        "description": "Budget for grad students with stipend",
        "monthly_total": 2000,
        "categories": {
            "Food": 300,
            "Transport": 100,
            "Shopping": 100,
            "Entertainment": 100,
            "Bills": 800,
            "Healthcare": 50,
            "Education": 300,
            "Personal": 100,
            "Savings": 100,
            "Other": 50
        }
    },
    "intern": {
        "name": "Summer Intern",
        "description": "Budget for paid interns",
        "monthly_total": 2500,
        "categories": {
            "Food": 350,
            "Transport": 150,
            "Shopping": 150,
            "Entertainment": 100,
            "Bills": 1000,
            "Healthcare": 50,
            "Education": 50,
            "Personal": 100,
            "Savings": 500,
            "Other": 50
        }
    },
    "freelancer": {
        "name": "Freelancer/Gig Worker",
        "description": "Variable income budget",
        "monthly_total": 2200,
        "categories": {
            "Food": 300,
            "Transport": 150,
            "Shopping": 100,
            "Entertainment": 100,
            "Bills": 900,
            "Healthcare": 150,
            "Education": 50,
            "Personal": 100,
            "Savings": 300,
            "Other": 50
        }
    }
}

# Pydantic models for requests/responses
class CategoryBudgetCreate(BaseModel):
    category: str
    amount: float
    period: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: date
    end_date: Optional[date] = None

class CategoryBudgetResponse(BaseModel):
    id: int
    category: str
    amount: float
    period: BudgetPeriod
    spent: float
    remaining: float
    percentage: float
    is_active: bool
    start_date: date
    end_date: Optional[date]

class BillCreate(BaseModel):
    name: str
    amount: float
    category: str
    due_day: int
    frequency: BudgetPeriod = BudgetPeriod.MONTHLY
    is_autopay: bool = False
    reminder_days_before: int = 3

class SavingsGoalCreate(BaseModel):
    name: str
    target_amount: float
    target_date: Optional[date] = None
    auto_contribute: bool = False
    auto_contribute_amount: Optional[float] = None

class BudgetAnalysis(BaseModel):
    total_budget: float
    total_spent: float
    total_remaining: float
    days_left_in_period: int
    daily_budget_remaining: float
    categories: List[CategoryBudgetResponse]
    overspending_categories: List[str]
    savings_rate: float

# Helper functions
def get_period_dates(period: BudgetPeriod, custom_start: Optional[date] = None) -> tuple[date, date]:
    """Get start and end dates for a budget period"""
    today = date.today()
    
    if period == BudgetPeriod.WEEKLY:
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == BudgetPeriod.BIWEEKLY:
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=13)
    elif period == BudgetPeriod.MONTHLY:
        start = today.replace(day=1)
        next_month = today.replace(day=28) + timedelta(days=4)
        end = next_month - timedelta(days=next_month.day)
    elif period == BudgetPeriod.QUARTERLY:
        quarter = (today.month - 1) // 3
        start = date(today.year, quarter * 3 + 1, 1)
        end = date(today.year, quarter * 3 + 3, 1) + timedelta(days=31)
        end = end.replace(day=1) - timedelta(days=1)
    elif period == BudgetPeriod.YEARLY:
        start = today.replace(month=1, day=1)
        end = today.replace(month=12, day=31)
    else:  # CUSTOM
        if custom_start:
            start = custom_start
            end = custom_start + timedelta(days=30)  # Default 30 days
        else:
            start = today
            end = today + timedelta(days=30)
    
    return start, end

# Endpoints
@router.get("/budgets/templates")
def get_budget_templates():
    """Get available budget templates"""
    return BUDGET_TEMPLATES

@router.post("/budgets/apply-template")
def apply_budget_template(
    template_id: str,
    user: User = Depends(get_current_user)
):
    """Apply a budget template to user's account"""
    if template_id not in BUDGET_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = BUDGET_TEMPLATES[template_id]
    
    with Session(engine) as session:
        # Deactivate existing budgets
        existing = session.exec(
            select(CategoryBudget).where(
                CategoryBudget.user_id == user.id,
                CategoryBudget.is_active == True
            )
        ).all()
        
        for budget in existing:
            budget.is_active = False
        
        # Create new budgets from template
        start_date, end_date = get_period_dates(BudgetPeriod.MONTHLY)
        
        for category, amount in template["categories"].items():
            budget = CategoryBudget(
                user_id=user.id,
                category=category,
                amount=amount,
                period=BudgetPeriod.MONTHLY,
                start_date=start_date,
                is_active=True
            )
            session.add(budget)
        
        # Also create overall budget goal
        budget_goal = BudgetGoal(
            user_id=user.id,
            month=start_date,
            amount=template["monthly_total"]
        )
        session.add(budget_goal)
        
        session.commit()
        
    return {"message": f"Applied {template['name']} template successfully"}

@router.get("/budgets/categories", response_model=List[CategoryBudgetResponse])
def get_category_budgets(
    period: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get all active category budgets with spending info"""
    with Session(engine) as session:
        # Get active budgets
        query = select(CategoryBudget).where(
            CategoryBudget.user_id == user.id,
            CategoryBudget.is_active == True
        )
        
        if period:
            query = query.where(CategoryBudget.period == period)
        
        budgets = session.exec(query).all()
        
        response = []
        for budget in budgets:
            # Calculate spending for this category in the budget period
            start_date, end_date = get_period_dates(
                budget.period,
                budget.start_date if budget.period == BudgetPeriod.CUSTOM else None
            )
            
            spent = session.exec(
                select(func.sum(func.abs(Tx.amount))).where(
                    Tx.user_id == user.id,
                    Tx.label == budget.category,
                    Tx.tx_date >= start_date,
                    Tx.tx_date <= end_date,
                    Tx.amount < 0
                )
            ).first() or 0
            
            remaining = budget.amount - spent
            percentage = (spent / budget.amount * 100) if budget.amount > 0 else 0
            
            response.append(CategoryBudgetResponse(
                id=budget.id,
                category=budget.category,
                amount=budget.amount,
                period=budget.period,
                spent=spent,
                remaining=remaining,
                percentage=percentage,
                is_active=budget.is_active,
                start_date=budget.start_date,
                end_date=budget.end_date
            ))
        
        return response

@router.post("/budgets/categories", response_model=CategoryBudgetResponse)
def create_category_budget(
    budget_data: CategoryBudgetCreate,
    user: User = Depends(get_current_user)
):
    """Create a new category budget"""
    with Session(engine) as session:
        # Check if budget already exists for this category
        existing = session.exec(
            select(CategoryBudget).where(
                CategoryBudget.user_id == user.id,
                CategoryBudget.category == budget_data.category,
                CategoryBudget.is_active == True
            )
        ).first()
        
        if existing:
            existing.is_active = False
        
        # Create new budget
        budget = CategoryBudget(
            user_id=user.id,
            **budget_data.dict()
        )
        session.add(budget)
        session.commit()
        session.refresh(budget)
        
        # Return with spending info
        spent = 0  # New budget, no spending yet
        
        return CategoryBudgetResponse(
            id=budget.id,
            category=budget.category,
            amount=budget.amount,
            period=budget.period,
            spent=spent,
            remaining=budget.amount,
            percentage=0,
            is_active=budget.is_active,
            start_date=budget.start_date,
            end_date=budget.end_date
        )

@router.get("/budgets/analysis", response_model=BudgetAnalysis)
def get_budget_analysis(
    period: BudgetPeriod = Query(BudgetPeriod.MONTHLY),
    user: User = Depends(get_current_user)
):
    """Get comprehensive budget analysis"""
    with Session(engine) as session:
        # Get all category budgets for the period
        category_budgets = get_category_budgets(period, user)
        
        # Calculate totals
        total_budget = sum(b.amount for b in category_budgets)
        total_spent = sum(b.spent for b in category_budgets)
        total_remaining = total_budget - total_spent
        
        # Get period dates
        start_date, end_date = get_period_dates(period)
        days_left = (end_date - date.today()).days + 1
        daily_budget_remaining = total_remaining / days_left if days_left > 0 else 0
        
        # Find overspending categories
        overspending = [b.category for b in category_budgets if b.percentage > 100]
        
        # Calculate savings rate
        income = session.exec(
            select(func.sum(Tx.amount)).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date,
                Tx.amount > 0
            )
        ).first() or 0
        
        savings_rate = ((income - total_spent) / income * 100) if income > 0 else 0
        
        return BudgetAnalysis(
            total_budget=total_budget,
            total_spent=total_spent,
            total_remaining=total_remaining,
            days_left_in_period=days_left,
            daily_budget_remaining=daily_budget_remaining,
            categories=category_budgets,
            overspending_categories=overspending,
            savings_rate=savings_rate
        )

@router.get("/bills")
def get_bills(
    upcoming_days: int = Query(30, description="Show bills due in next N days"),
    user: User = Depends(get_current_user)
):
    """Get all bills with upcoming due dates"""
    with Session(engine) as session:
        bills = session.exec(
            select(Bill).where(
                Bill.user_id == user.id,
                Bill.is_active == True
            )
        ).all()
        
        # Calculate next due dates
        today = date.today()
        upcoming_bills = []
        
        for bill in bills:
            # Calculate next due date
            if bill.frequency == BudgetPeriod.MONTHLY:
                if today.day <= bill.due_day:
                    next_due = today.replace(day=bill.due_day)
                else:
                    next_month = today.replace(day=28) + timedelta(days=4)
                    next_due = next_month.replace(day=bill.due_day)
            else:
                # For other frequencies, use last_paid + frequency
                if bill.last_paid:
                    if bill.frequency == BudgetPeriod.WEEKLY:
                        next_due = bill.last_paid + timedelta(days=7)
                    elif bill.frequency == BudgetPeriod.BIWEEKLY:
                        next_due = bill.last_paid + timedelta(days=14)
                    else:
                        next_due = today + timedelta(days=30)
                else:
                    next_due = today
            
            bill.next_due = next_due
            
            # Check if due within requested days
            if (next_due - today).days <= upcoming_days:
                upcoming_bills.append(bill)
        
        # Sort by due date
        upcoming_bills.sort(key=lambda b: b.next_due)
        
        return upcoming_bills

@router.post("/bills")
def create_bill(
    bill_data: BillCreate,
    user: User = Depends(get_current_user)
):
    """Create a new bill reminder"""
    with Session(engine) as session:
        bill = Bill(
            user_id=user.id,
            **bill_data.dict()
        )
        session.add(bill)
        session.commit()
        session.refresh(bill)
        
        return bill

@router.get("/savings-goals")
def get_savings_goals(
    active_only: bool = Query(True),
    user: User = Depends(get_current_user)
):
    """Get all savings goals with progress"""
    with Session(engine) as session:
        query = select(SavingsGoal).where(SavingsGoal.user_id == user.id)
        
        if active_only:
            query = query.where(SavingsGoal.is_active == True)
        
        goals = session.exec(query).all()
        
        # Calculate progress
        response = []
        for goal in goals:
            progress = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
            
            # Calculate monthly contribution needed
            if goal.target_date and goal.target_date > date.today():
                months_left = (goal.target_date.year - date.today().year) * 12 + \
                             (goal.target_date.month - date.today().month)
                monthly_needed = (goal.target_amount - goal.current_amount) / months_left if months_left > 0 else 0
            else:
                monthly_needed = 0
            
            response.append({
                **goal.dict(),
                "progress_percentage": progress,
                "monthly_contribution_needed": monthly_needed
            })
        
        return response

@router.post("/savings-goals")
def create_savings_goal(
    goal_data: SavingsGoalCreate,
    user: User = Depends(get_current_user)
):
    """Create a new savings goal"""
    with Session(engine) as session:
        goal = SavingsGoal(
            user_id=user.id,
            **goal_data.dict()
        )
        session.add(goal)
        session.commit()
        session.refresh(goal)
        
        return goal

@router.post("/savings-goals/{goal_id}/contribute")
def contribute_to_goal(
    goal_id: int,
    amount: float,
    user: User = Depends(get_current_user)
):
    """Add contribution to savings goal"""
    with Session(engine) as session:
        goal = session.exec(
            select(SavingsGoal).where(
                SavingsGoal.id == goal_id,
                SavingsGoal.user_id == user.id
            )
        ).first()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Savings goal not found")
        
        goal.current_amount += amount
        
        # Check if goal achieved
        if goal.current_amount >= goal.target_amount and not goal.achieved_at:
            goal.achieved_at = datetime.utcnow()
            # Create achievement insight
            from insights_engine import InsightsGenerator
            generator = InsightsGenerator(session)
            generator._save_insight(
                user_id=user.id,
                insight_type="achievement",
                title=f"🎉 Goal Achieved: {goal.name}!",
                description=f"Congratulations! You've reached your savings goal of ${goal.target_amount:.2f}",
                priority="high",
                data={"goal_id": goal.id, "amount": goal.target_amount}
            )
        
        session.commit()
        
        return {"message": f"Added ${amount:.2f} to {goal.name}", "new_total": goal.current_amount}

@router.put("/bills/{bill_id}/mark-paid")
def mark_bill_paid(
    bill_id: int,
    user: User = Depends(get_current_user)
):
    """Mark a bill as paid"""
    with Session(engine) as session:
        bill = session.exec(
            select(Bill).where(
                Bill.id == bill_id,
                Bill.user_id == user.id
            )
        ).first()
        
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        
        bill.last_paid = date.today()
        
        # Create transaction for the payment
        from schemas import TxIn
        from transactions import create_tx
        
        tx_data = TxIn(
            tx_date=date.today(),
            amount=-bill.amount,
            label=bill.category,
            notes=f"Payment for {bill.name}",
            recurring=False
        )
        
        create_tx(tx_data, user, session)
        session.commit()
        
        return {"message": f"Marked {bill.name} as paid"}

@router.get("/budgets/alerts")
def get_budget_alerts(
    user: User = Depends(get_current_user)
):
    """Get active budget alerts"""
    with Session(engine) as session:
        # Get category budgets
        budgets = get_category_budgets(None, user)
        
        alerts = []
        for budget in budgets:
            if budget.percentage >= 80:
                alert_level = "critical" if budget.percentage >= 100 else "warning"
                alerts.append({
                    "category": budget.category,
                    "message": f"You've spent {budget.percentage:.0f}% of your {budget.category} budget",
                    "level": alert_level,
                    "spent": budget.spent,
                    "budget": budget.amount,
                    "remaining": budget.remaining
                })
        
        return alerts