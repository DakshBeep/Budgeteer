from typing import Optional, List
from datetime import date, datetime
from sqlmodel import SQLModel, Field, JSON, Column
from enum import Enum

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

class InsightType(str, Enum):
    ANOMALY = "anomaly"
    SAVINGS_OPPORTUNITY = "savings_opportunity"
    ACHIEVEMENT = "achievement"
    PREDICTION = "prediction"
    RECOMMENDATION = "recommendation"
    COMPARISON = "comparison"

class NotificationType(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"

class InsightPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class Insight(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: InsightType
    priority: InsightPriority
    title: str
    description: str
    data: dict = Field(sa_column=Column(JSON))  # Store additional data like amounts, percentages
    action_url: Optional[str] = None  # Link to relevant action
    is_read: bool = False
    is_dismissed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    
class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    insight_id: Optional[int] = Field(foreign_key="insight.id")
    type: NotificationType
    title: str
    message: str
    is_sent: bool = False
    is_read: bool = False
    scheduled_for: datetime
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserPreferences(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    email_digest_frequency: str = "weekly"  # daily, weekly, monthly, never
    notification_types: List[str] = Field(sa_column=Column(JSON), default=["in_app", "email"])
    insight_categories: List[str] = Field(sa_column=Column(JSON), default=["all"])
    quiet_hours_start: Optional[int] = None  # Hour of day (0-23)
    quiet_hours_end: Optional[int] = None
    peer_comparison_opt_in: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FinancialHealthScore(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    score: float  # 0-100
    components: dict = Field(sa_column=Column(JSON))  # Breakdown of score components
    trend: str  # "improving", "stable", "declining"
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
    
class SpendingBenchmark(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str
    user_demographic: Optional[str] = None  # e.g., "student", "young_professional"
    average_percentage: float  # Average % of income spent on this category
    median_amount: float
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Enhanced Budget Management Models
class BudgetPeriod(str, Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"

class BudgetTemplate(str, Enum):
    BROKE_STUDENT = "broke_student"
    FIRST_JOB = "first_job"
    GRAD_STUDENT = "grad_student"
    INTERN = "intern"
    FREELANCER = "freelancer"
    CUSTOM = "custom"

class CategoryBudget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    category: str  # Food, Transport, etc.
    amount: float
    period: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: date
    end_date: Optional[date] = None  # For custom periods
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BudgetAlert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    category_budget_id: Optional[int] = Field(foreign_key="categorybudget.id")
    alert_threshold: float = 0.8  # Alert at 80% by default
    is_enabled: bool = True
    last_triggered: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SavingsGoal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str  # "Emergency Fund", "Spring Break Trip", etc.
    target_amount: float
    current_amount: float = 0.0
    target_date: Optional[date] = None
    category: str = "Savings"  # Links to transaction categories
    auto_contribute: bool = False
    auto_contribute_amount: Optional[float] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    achieved_at: Optional[datetime] = None

class Bill(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str  # "Rent", "Netflix", etc.
    amount: float
    category: str
    due_day: int  # Day of month (1-31)
    frequency: BudgetPeriod = BudgetPeriod.MONTHLY
    is_autopay: bool = False
    reminder_days_before: int = 3
    last_paid: Optional[date] = None
    next_due: Optional[date] = None
    series_id: Optional[int] = Field(index=True)  # Links to recurring transactions
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
