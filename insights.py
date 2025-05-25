"""
Insights API endpoints for financial insights and recommendations
"""
from datetime import datetime, timedelta, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func
from pydantic import BaseModel

from database import engine
from auth import get_current_user
from dbmodels import (
    User, Insight, InsightType, InsightPriority, Notification, NotificationType,
    UserPreferences, FinancialHealthScore, Tx, BudgetGoal
)
from insights_engine import InsightsGenerator
from schemas import User as UserSchema


router = APIRouter()


class InsightResponse(BaseModel):
    id: int
    type: InsightType
    priority: InsightPriority
    title: str
    description: str
    data: dict
    action_url: Optional[str]
    is_read: bool
    is_dismissed: bool
    created_at: datetime
    expires_at: Optional[datetime]


class HealthScoreResponse(BaseModel):
    score: float
    components: dict
    trend: str
    calculated_at: datetime
    recommendations: List[str]


class PreferencesUpdate(BaseModel):
    email_digest_frequency: Optional[str] = None
    notification_types: Optional[List[str]] = None
    insight_categories: Optional[List[str]] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None
    peer_comparison_opt_in: Optional[bool] = None


class WhatIfScenario(BaseModel):
    category: str
    reduction_percentage: float


class WhatIfResponse(BaseModel):
    current_monthly_spending: float
    projected_monthly_spending: float
    monthly_savings: float
    annual_savings: float
    impact_on_budget: str


def generate_user_insights_task(user_id: int):
    """Background task to generate insights for a user"""
    generator = InsightsGenerator(user_id)
    insights = generator.generate_all_insights()
    
    with Session(engine) as session:
        # Remove old insights (older than 30 days)
        old_date = datetime.utcnow() - timedelta(days=30)
        old_insights = session.exec(
            select(Insight).where(
                Insight.user_id == user_id,
                Insight.created_at < old_date
            )
        ).all()
        
        for insight in old_insights:
            session.delete(insight)
        
        # Add new insights
        for insight in insights:
            # Check if similar insight already exists
            existing = session.exec(
                select(Insight).where(
                    Insight.user_id == user_id,
                    Insight.type == insight.type,
                    Insight.title == insight.title,
                    Insight.created_at > datetime.utcnow() - timedelta(days=7)
                )
            ).first()
            
            if not existing:
                session.add(insight)
        
        # Calculate and save financial health score
        health_score = generator.calculate_financial_health_score()
        session.add(health_score)
        
        session.commit()


@router.get("/insights", response_model=List[InsightResponse])
def get_insights(
    type: Optional[InsightType] = None,
    priority: Optional[InsightPriority] = None,
    is_read: Optional[bool] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    user: UserSchema = Depends(get_current_user)
):
    """Get user's insights with optional filtering"""
    with Session(engine) as session:
        query = select(Insight).where(
            Insight.user_id == user.id,
            Insight.is_dismissed == False
        )
        
        if type:
            query = query.where(Insight.type == type)
        if priority:
            query = query.where(Insight.priority == priority)
        if is_read is not None:
            query = query.where(Insight.is_read == is_read)
        
        # Order by priority and creation date
        query = query.order_by(
            Insight.priority.desc(),
            Insight.created_at.desc()
        ).offset(offset).limit(limit)
        
        insights = session.exec(query).all()
        return insights


@router.post("/insights/generate")
def generate_insights(
    background_tasks: BackgroundTasks,
    user: UserSchema = Depends(get_current_user)
):
    """Trigger insight generation for the current user"""
    background_tasks.add_task(generate_user_insights_task, user.id)
    return {"message": "Insight generation started", "status": "processing"}


@router.put("/insights/{insight_id}/read")
def mark_insight_read(
    insight_id: int,
    user: UserSchema = Depends(get_current_user)
):
    """Mark an insight as read"""
    with Session(engine) as session:
        insight = session.exec(
            select(Insight).where(
                Insight.id == insight_id,
                Insight.user_id == user.id
            )
        ).first()
        
        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")
        
        insight.is_read = True
        session.add(insight)
        session.commit()
        
        return {"message": "Insight marked as read"}


@router.put("/insights/{insight_id}/dismiss")
def dismiss_insight(
    insight_id: int,
    user: UserSchema = Depends(get_current_user)
):
    """Dismiss an insight"""
    with Session(engine) as session:
        insight = session.exec(
            select(Insight).where(
                Insight.id == insight_id,
                Insight.user_id == user.id
            )
        ).first()
        
        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")
        
        insight.is_dismissed = True
        session.add(insight)
        session.commit()
        
        return {"message": "Insight dismissed"}


@router.get("/insights/health-score", response_model=HealthScoreResponse)
def get_health_score(user: UserSchema = Depends(get_current_user)):
    """Get user's financial health score"""
    with Session(engine) as session:
        # Get latest health score
        health_score = session.exec(
            select(FinancialHealthScore).where(
                FinancialHealthScore.user_id == user.id
            ).order_by(FinancialHealthScore.calculated_at.desc())
        ).first()
        
        if not health_score:
            # Generate health score if none exists
            generator = InsightsGenerator(user.id)
            health_score = generator.calculate_financial_health_score()
            session.add(health_score)
            session.commit()
        
        # Generate recommendations based on score components
        recommendations = []
        
        if health_score.components.get('budget_adherence', 0) < 70:
            recommendations.append("Consider setting more realistic budget goals")
        
        if health_score.components.get('spending_consistency', 0) < 60:
            recommendations.append("Try to maintain more consistent spending patterns")
        
        if health_score.components.get('savings_rate', 0) < 50:
            recommendations.append("Focus on increasing your savings rate")
        
        if health_score.components.get('category_balance', 0) < 60:
            recommendations.append("Diversify your spending across different categories")
        
        return HealthScoreResponse(
            score=health_score.score,
            components=health_score.components,
            trend=health_score.trend,
            calculated_at=health_score.calculated_at,
            recommendations=recommendations
        )


@router.get("/insights/preferences")
def get_preferences(user: UserSchema = Depends(get_current_user)):
    """Get user's notification preferences"""
    with Session(engine) as session:
        prefs = session.exec(
            select(UserPreferences).where(
                UserPreferences.user_id == user.id
            )
        ).first()
        
        if not prefs:
            # Create default preferences
            prefs = UserPreferences(user_id=user.id)
            session.add(prefs)
            session.commit()
        
        return prefs


@router.put("/insights/preferences")
def update_preferences(
    preferences: PreferencesUpdate,
    user: UserSchema = Depends(get_current_user)
):
    """Update user's notification preferences"""
    with Session(engine) as session:
        prefs = session.exec(
            select(UserPreferences).where(
                UserPreferences.user_id == user.id
            )
        ).first()
        
        if not prefs:
            prefs = UserPreferences(user_id=user.id)
        
        # Update only provided fields
        update_data = preferences.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prefs, field, value)
        
        prefs.updated_at = datetime.utcnow()
        session.add(prefs)
        session.commit()
        
        return {"message": "Preferences updated successfully"}


@router.post("/insights/what-if", response_model=WhatIfResponse)
def calculate_what_if(
    scenario: WhatIfScenario,
    user: UserSchema = Depends(get_current_user)
):
    """Calculate what-if scenarios for budget planning"""
    with Session(engine) as session:
        # Get last 30 days spending for the category
        start_date = date.today() - timedelta(days=30)
        
        category_spending = session.exec(
            select(func.sum(func.abs(Tx.amount))).where(
                Tx.user_id == user.id,
                Tx.tx_date >= start_date,
                Tx.label == scenario.category,
                Tx.amount < 0
            )
        ).first() or 0
        
        # Calculate projections
        reduction_factor = 1 - (scenario.reduction_percentage / 100)
        projected_spending = category_spending * reduction_factor
        monthly_savings = category_spending - projected_spending
        annual_savings = monthly_savings * 12
        
        # Get current budget
        current_month = date.today().replace(day=1)
        budget_goal = session.exec(
            select(BudgetGoal).where(
                BudgetGoal.user_id == user.id,
                BudgetGoal.month == current_month
            )
        ).first()
        
        if budget_goal:
            total_spending = session.exec(
                select(func.sum(func.abs(Tx.amount))).where(
                    Tx.user_id == user.id,
                    Tx.tx_date >= current_month,
                    Tx.amount < 0
                )
            ).first() or 0
            
            new_total = total_spending - (category_spending - projected_spending)
            if new_total < budget_goal.amount * 0.8:
                impact = "Well within budget (>20% margin)"
            elif new_total < budget_goal.amount:
                impact = "Within budget"
            else:
                impact = "Still over budget"
        else:
            impact = "No budget set"
        
        return WhatIfResponse(
            current_monthly_spending=category_spending,
            projected_monthly_spending=projected_spending,
            monthly_savings=monthly_savings,
            annual_savings=annual_savings,
            impact_on_budget=impact
        )


@router.get("/insights/digest")
def get_digest_preview(user: UserSchema = Depends(get_current_user)):
    """Get a preview of what would be in the email digest"""
    with Session(engine) as session:
        # Get recent insights
        recent_insights = session.exec(
            select(Insight).where(
                Insight.user_id == user.id,
                Insight.created_at >= datetime.utcnow() - timedelta(days=7),
                Insight.is_dismissed == False
            ).order_by(Insight.priority.desc())
        ).all()
        
        # Get spending summary
        week_ago = date.today() - timedelta(days=7)
        spending = session.exec(
            select(func.sum(func.abs(Tx.amount))).where(
                Tx.user_id == user.id,
                Tx.tx_date >= week_ago,
                Tx.amount < 0
            )
        ).first() or 0
        
        # Get top categories
        top_categories = session.exec(
            select(Tx.label, func.sum(func.abs(Tx.amount)).label("total"))
            .where(
                Tx.user_id == user.id,
                Tx.tx_date >= week_ago,
                Tx.amount < 0
            )
            .group_by(Tx.label)
            .order_by(func.sum(func.abs(Tx.amount)).desc())
            .limit(3)
        ).all()
        
        return {
            "period": "Last 7 days",
            "total_spending": spending,
            "insight_count": len(recent_insights),
            "top_insights": [
                {
                    "title": i.title,
                    "description": i.description,
                    "type": i.type
                }
                for i in recent_insights[:3]
            ],
            "top_categories": [
                {"category": cat, "amount": amt}
                for cat, amt in top_categories
            ]
        }


@router.get("/insights/notifications")
def get_notifications(
    is_read: Optional[bool] = None,
    limit: int = Query(20, le=100),
    user: UserSchema = Depends(get_current_user)
):
    """Get user's notifications"""
    with Session(engine) as session:
        query = select(Notification).where(
            Notification.user_id == user.id
        )
        
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
        
        query = query.order_by(
            Notification.scheduled_for.desc()
        ).limit(limit)
        
        notifications = session.exec(query).all()
        return notifications