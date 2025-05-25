"""
Smart Financial Insights & Automation Engine
Analyzes spending patterns and generates actionable insights
"""
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple
import statistics
from collections import defaultdict
import numpy as np
from sqlmodel import Session, select, func
from database import engine
from dbmodels import (
    User, Tx, BudgetGoal, Insight, InsightType, InsightPriority,
    FinancialHealthScore, SpendingBenchmark
)


class AnomalyDetector:
    """Detects unusual spending patterns and anomalies"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.session = Session(engine)
        
    def detect_anomalies(self) -> List[Dict]:
        """Main method to detect all types of anomalies"""
        anomalies = []
        
        # Get user's transaction history
        end_date = date.today()
        start_date = end_date - timedelta(days=90)  # Analyze last 90 days
        
        transactions = self.session.exec(
            select(Tx).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date
            )
        ).all()
        
        if len(transactions) < 10:  # Need minimum data
            return anomalies
            
        # Detect various anomalies
        anomalies.extend(self._detect_unusual_amounts(transactions))
        anomalies.extend(self._detect_category_spikes(transactions))
        anomalies.extend(self._detect_duplicate_charges(transactions))
        anomalies.extend(self._detect_subscription_creep(transactions))
        
        return anomalies
    
    def _detect_unusual_amounts(self, transactions: List[Tx]) -> List[Dict]:
        """Detect transactions with unusual amounts"""
        anomalies = []
        
        # Group by category
        category_amounts = defaultdict(list)
        for tx in transactions:
            if tx.amount < 0:  # Only expenses
                category_amounts[tx.label].append(abs(tx.amount))
        
        for category, amounts in category_amounts.items():
            if len(amounts) < 5:  # Need enough data
                continue
                
            mean = statistics.mean(amounts)
            stdev = statistics.stdev(amounts) if len(amounts) > 1 else 0
            
            # Find outliers (3 standard deviations)
            for tx in transactions:
                if tx.label == category and tx.amount < 0:
                    amount = abs(tx.amount)
                    if stdev > 0 and abs(amount - mean) > 3 * stdev:
                        anomalies.append({
                            'type': 'unusual_amount',
                            'category': category,
                            'transaction_id': tx.id,
                            'amount': amount,
                            'average': mean,
                            'deviation': abs(amount - mean) / mean * 100,
                            'date': tx.tx_date,
                            'title': f"Unusual {category} expense",
                            'description': f"${amount:.2f} is {abs(amount - mean) / mean * 100:.0f}% higher than your typical {category} expense of ${mean:.2f}"
                        })
        
        return anomalies
    
    def _detect_category_spikes(self, transactions: List[Tx]) -> List[Dict]:
        """Detect sudden increases in category spending"""
        anomalies = []
        
        # Compare last 7 days to previous 30 days
        recent_date = date.today() - timedelta(days=7)
        comparison_date = date.today() - timedelta(days=37)
        
        recent_spending = defaultdict(float)
        previous_spending = defaultdict(float)
        
        for tx in transactions:
            if tx.amount < 0:  # Only expenses
                if tx.tx_date >= recent_date:
                    recent_spending[tx.label] += abs(tx.amount)
                elif tx.tx_date >= comparison_date:
                    previous_spending[tx.label] += abs(tx.amount)
        
        for category in recent_spending:
            if category in previous_spending:
                recent_weekly = recent_spending[category]
                previous_weekly_avg = previous_spending[category] / 4.3  # ~30 days / 7
                
                if previous_weekly_avg > 0:
                    increase_pct = ((recent_weekly - previous_weekly_avg) / previous_weekly_avg) * 100
                    
                    if increase_pct > 200:  # 200% increase threshold
                        anomalies.append({
                            'type': 'category_spike',
                            'category': category,
                            'recent_amount': recent_weekly,
                            'typical_amount': previous_weekly_avg,
                            'increase_percentage': increase_pct,
                            'title': f"Spike in {category} spending",
                            'description': f"You spent ${recent_weekly:.2f} on {category} this week, {increase_pct:.0f}% more than your typical weekly spending of ${previous_weekly_avg:.2f}"
                        })
        
        return anomalies
    
    def _detect_duplicate_charges(self, transactions: List[Tx]) -> List[Dict]:
        """Detect potential duplicate charges"""
        anomalies = []
        
        # Look for same amount, same category within 3 days
        for i, tx1 in enumerate(transactions):
            if tx1.amount >= 0:  # Skip income
                continue
                
            for tx2 in transactions[i+1:]:
                if tx2.amount >= 0:  # Skip income
                    continue
                    
                days_apart = abs((tx1.tx_date - tx2.tx_date).days)
                
                if (tx1.amount == tx2.amount and 
                    tx1.label == tx2.label and 
                    days_apart <= 3 and
                    days_apart > 0):
                    
                    anomalies.append({
                        'type': 'duplicate_charge',
                        'transaction_ids': [tx1.id, tx2.id],
                        'amount': abs(tx1.amount),
                        'category': tx1.label,
                        'dates': [tx1.tx_date, tx2.tx_date],
                        'title': f"Potential duplicate {tx1.label} charge",
                        'description': f"Two identical charges of ${abs(tx1.amount):.2f} for {tx1.label} within {days_apart} days"
                    })
        
        return anomalies
    
    def _detect_subscription_creep(self, transactions: List[Tx]) -> List[Dict]:
        """Detect increasing subscription costs"""
        anomalies = []
        
        # Identify recurring transactions
        recurring_patterns = defaultdict(list)
        
        for tx in transactions:
            if tx.recurring or tx.series_id:
                key = (tx.label, abs(int(tx.amount)))  # Group by category and amount
                recurring_patterns[key].append(tx)
        
        # Look for subscriptions that have increased
        subscription_amounts = defaultdict(list)
        for tx in transactions:
            if tx.amount < 0:  # Expenses only
                # Check if it might be a subscription (monthly recurring)
                similar_txs = [t for t in transactions 
                             if t.label == tx.label 
                             and abs(abs(t.amount) - abs(tx.amount)) < 5  # Allow small variations
                             and t.id != tx.id]
                
                if len(similar_txs) >= 2:  # At least 3 similar transactions
                    subscription_amounts[tx.label].append({
                        'amount': abs(tx.amount),
                        'date': tx.tx_date
                    })
        
        for category, amounts in subscription_amounts.items():
            if len(amounts) >= 3:
                # Sort by date
                amounts.sort(key=lambda x: x['date'])
                
                # Check if amounts are increasing
                first_amount = amounts[0]['amount']
                last_amount = amounts[-1]['amount']
                
                if last_amount > first_amount * 1.1:  # 10% increase
                    increase_pct = ((last_amount - first_amount) / first_amount) * 100
                    anomalies.append({
                        'type': 'subscription_creep',
                        'category': category,
                        'initial_amount': first_amount,
                        'current_amount': last_amount,
                        'increase_percentage': increase_pct,
                        'title': f"{category} subscription cost increased",
                        'description': f"Your {category} subscription has increased from ${first_amount:.2f} to ${last_amount:.2f} ({increase_pct:.0f}% increase)"
                    })
        
        return anomalies
    
    def __del__(self):
        self.session.close()


class InsightsGenerator:
    """Generates various types of financial insights"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.session = Session(engine)
        self.anomaly_detector = AnomalyDetector(user_id)
        
    def generate_all_insights(self) -> List[Insight]:
        """Generate all types of insights for the user"""
        insights = []
        
        # Anomaly detection insights
        anomalies = self.anomaly_detector.detect_anomalies()
        for anomaly in anomalies:
            insight = Insight(
                user_id=self.user_id,
                type=InsightType.ANOMALY,
                priority=InsightPriority.HIGH if anomaly['type'] == 'duplicate_charge' else InsightPriority.MEDIUM,
                title=anomaly['title'],
                description=anomaly['description'],
                data=anomaly,
                created_at=datetime.utcnow()
            )
            insights.append(insight)
        
        # Generate other insights
        insights.extend(self._generate_savings_opportunities())
        insights.extend(self._generate_achievements())
        insights.extend(self._generate_predictions())
        insights.extend(self._generate_recommendations())
        
        return insights
    
    def _generate_savings_opportunities(self) -> List[Insight]:
        """Identify opportunities to save money"""
        insights = []
        
        # Analyze spending by category over last 30 days
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        
        transactions = self.session.exec(
            select(Tx).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= start_date,
                Tx.tx_date <= end_date,
                Tx.amount < 0  # Expenses only
            )
        ).all()
        
        # Category spending analysis
        category_spending = defaultdict(float)
        category_count = defaultdict(int)
        
        for tx in transactions:
            category_spending[tx.label] += abs(tx.amount)
            category_count[tx.label] += 1
        
        # Find categories with high frequency and spending
        for category, total_spent in category_spending.items():
            count = category_count[category]
            
            # High frequency categories (more than 10 times a month)
            if count > 10:
                avg_per_transaction = total_spent / count
                potential_savings = total_spent * 0.2  # Assume 20% reduction possible
                
                insight = Insight(
                    user_id=self.user_id,
                    type=InsightType.SAVINGS_OPPORTUNITY,
                    priority=InsightPriority.MEDIUM,
                    title=f"Save on {category} expenses",
                    description=f"You spent ${total_spent:.2f} on {category} across {count} transactions. Reducing by 20% could save you ${potential_savings:.2f}/month!",
                    data={
                        'category': category,
                        'total_spent': total_spent,
                        'transaction_count': count,
                        'potential_savings': potential_savings,
                        'avg_per_transaction': avg_per_transaction
                    },
                    created_at=datetime.utcnow()
                )
                insights.append(insight)
        
        return insights
    
    def _generate_achievements(self) -> List[Insight]:
        """Recognize positive financial behaviors"""
        insights = []
        
        # Compare current month to previous month
        today = date.today()
        current_month_start = today.replace(day=1)
        last_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
        last_month_end = current_month_start - timedelta(days=1)
        
        current_transactions = self.session.exec(
            select(Tx).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= current_month_start,
                Tx.amount < 0
            )
        ).all()
        
        last_transactions = self.session.exec(
            select(Tx).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= last_month_start,
                Tx.tx_date <= last_month_end,
                Tx.amount < 0
            )
        ).all()
        
        # Category comparison
        current_spending = defaultdict(float)
        last_spending = defaultdict(float)
        
        for tx in current_transactions:
            current_spending[tx.label] += abs(tx.amount)
        
        for tx in last_transactions:
            last_spending[tx.label] += abs(tx.amount)
        
        # Find categories with reduced spending
        for category in last_spending:
            if category in current_spending:
                reduction = last_spending[category] - current_spending[category]
                reduction_pct = (reduction / last_spending[category]) * 100
                
                if reduction > 50 and reduction_pct > 20:  # Significant reduction
                    insight = Insight(
                        user_id=self.user_id,
                        type=InsightType.ACHIEVEMENT,
                        priority=InsightPriority.LOW,
                        title=f"Great job reducing {category} spending! 🎉",
                        description=f"You've reduced your {category} spending by ${reduction:.2f} ({reduction_pct:.0f}%) compared to last month!",
                        data={
                            'category': category,
                            'last_month': last_spending[category],
                            'current_month': current_spending[category],
                            'reduction': reduction,
                            'reduction_percentage': reduction_pct
                        },
                        created_at=datetime.utcnow()
                    )
                    insights.append(insight)
        
        return insights
    
    def _generate_predictions(self) -> List[Insight]:
        """Generate predictive insights about future spending"""
        insights = []
        
        # Get current month's budget goal
        current_month = date.today().replace(day=1)
        budget_goal = self.session.exec(
            select(BudgetGoal).where(
                BudgetGoal.user_id == self.user_id,
                BudgetGoal.month == current_month
            )
        ).first()
        
        if not budget_goal:
            return insights
        
        # Calculate current spending rate
        days_in_month = 30  # Approximate
        days_passed = date.today().day
        days_remaining = days_in_month - days_passed
        
        current_spending = self.session.exec(
            select(func.sum(func.abs(Tx.amount))).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= current_month,
                Tx.amount < 0
            )
        ).first() or 0
        
        if days_passed > 0:
            daily_rate = current_spending / days_passed
            projected_total = daily_rate * days_in_month
            
            if projected_total > budget_goal.amount:
                days_until_exceed = int((budget_goal.amount - current_spending) / daily_rate)
                overage = projected_total - budget_goal.amount
                
                insight = Insight(
                    user_id=self.user_id,
                    type=InsightType.PREDICTION,
                    priority=InsightPriority.HIGH if days_until_exceed < 7 else InsightPriority.MEDIUM,
                    title="Budget alert: You're on track to exceed your budget",
                    description=f"At your current spending rate of ${daily_rate:.2f}/day, you'll exceed your ${budget_goal.amount:.2f} budget in {max(0, days_until_exceed)} days. Projected overage: ${overage:.2f}",
                    data={
                        'current_spending': current_spending,
                        'daily_rate': daily_rate,
                        'projected_total': projected_total,
                        'budget': budget_goal.amount,
                        'days_until_exceed': days_until_exceed,
                        'overage': overage
                    },
                    created_at=datetime.utcnow()
                )
                insights.append(insight)
        
        return insights
    
    def _generate_recommendations(self) -> List[Insight]:
        """Generate personalized recommendations"""
        insights = []
        
        # Analyze spending patterns for recommendations
        transactions = self.session.exec(
            select(Tx).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= date.today() - timedelta(days=30)
            )
        ).all()
        
        # Check for missing budget goal
        current_month = date.today().replace(day=1)
        budget_goal = self.session.exec(
            select(BudgetGoal).where(
                BudgetGoal.user_id == self.user_id,
                BudgetGoal.month == current_month
            )
        ).first()
        
        if not budget_goal and len(transactions) > 10:
            # Calculate average monthly spending
            total_spending = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)
            
            insight = Insight(
                user_id=self.user_id,
                type=InsightType.RECOMMENDATION,
                priority=InsightPriority.MEDIUM,
                title="Set a monthly budget goal",
                description=f"Based on your spending patterns, we recommend setting a monthly budget of ${total_spending * 1.1:.2f}. This gives you a 10% cushion while encouraging mindful spending.",
                data={
                    'recommended_budget': total_spending * 1.1,
                    'current_spending': total_spending
                },
                action_url="/dashboard",  # Link to budget setting
                created_at=datetime.utcnow()
            )
            insights.append(insight)
        
        return insights
    
    def calculate_financial_health_score(self) -> FinancialHealthScore:
        """Calculate comprehensive financial health score"""
        
        # Components of the score
        budget_adherence_score = self._calculate_budget_adherence()
        spending_consistency_score = self._calculate_spending_consistency()
        savings_rate_score = self._calculate_savings_rate()
        category_balance_score = self._calculate_category_balance()
        
        # Weighted average
        total_score = (
            budget_adherence_score * 0.3 +
            spending_consistency_score * 0.2 +
            savings_rate_score * 0.3 +
            category_balance_score * 0.2
        )
        
        # Determine trend
        previous_score = self.session.exec(
            select(FinancialHealthScore).where(
                FinancialHealthScore.user_id == self.user_id
            ).order_by(FinancialHealthScore.calculated_at.desc())
        ).first()
        
        if previous_score:
            if total_score > previous_score.score + 2:
                trend = "improving"
            elif total_score < previous_score.score - 2:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        health_score = FinancialHealthScore(
            user_id=self.user_id,
            score=total_score,
            components={
                'budget_adherence': budget_adherence_score,
                'spending_consistency': spending_consistency_score,
                'savings_rate': savings_rate_score,
                'category_balance': category_balance_score
            },
            trend=trend,
            calculated_at=datetime.utcnow()
        )
        
        return health_score
    
    def _calculate_budget_adherence(self) -> float:
        """Score based on staying within budget"""
        current_month = date.today().replace(day=1)
        
        # Get last 3 months of budget goals
        budget_goals = self.session.exec(
            select(BudgetGoal).where(
                BudgetGoal.user_id == self.user_id,
                BudgetGoal.month >= current_month - timedelta(days=90)
            )
        ).all()
        
        if not budget_goals:
            return 50.0  # Neutral score if no budget set
        
        adherence_scores = []
        
        for goal in budget_goals:
            # Get spending for that month
            month_end = (goal.month + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            spending = self.session.exec(
                select(func.sum(func.abs(Tx.amount))).where(
                    Tx.user_id == self.user_id,
                    Tx.tx_date >= goal.month,
                    Tx.tx_date <= month_end,
                    Tx.amount < 0
                )
            ).first() or 0
            
            if goal.amount > 0:
                adherence = min(100, (goal.amount / spending * 100) if spending > 0 else 100)
                adherence_scores.append(adherence)
        
        return sum(adherence_scores) / len(adherence_scores) if adherence_scores else 50.0
    
    def _calculate_spending_consistency(self) -> float:
        """Score based on spending consistency (lower variance is better)"""
        # Get weekly spending for last 8 weeks
        weekly_spending = []
        
        for week in range(8):
            week_start = date.today() - timedelta(days=7 * (week + 1))
            week_end = week_start + timedelta(days=7)
            
            spending = self.session.exec(
                select(func.sum(func.abs(Tx.amount))).where(
                    Tx.user_id == self.user_id,
                    Tx.tx_date >= week_start,
                    Tx.tx_date < week_end,
                    Tx.amount < 0
                )
            ).first() or 0
            
            weekly_spending.append(spending)
        
        if len(weekly_spending) < 2:
            return 50.0
        
        # Calculate coefficient of variation
        mean = statistics.mean(weekly_spending)
        stdev = statistics.stdev(weekly_spending)
        
        if mean > 0:
            cv = stdev / mean
            # Convert to score (lower CV is better)
            score = max(0, min(100, 100 * (1 - cv)))
            return score
        
        return 50.0
    
    def _calculate_savings_rate(self) -> float:
        """Score based on income vs expenses"""
        # Last 30 days
        start_date = date.today() - timedelta(days=30)
        
        income = self.session.exec(
            select(func.sum(Tx.amount)).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= start_date,
                Tx.amount > 0
            )
        ).first() or 0
        
        expenses = abs(self.session.exec(
            select(func.sum(Tx.amount)).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= start_date,
                Tx.amount < 0
            )
        ).first() or 0)
        
        if income > 0:
            savings_rate = (income - expenses) / income
            # Convert to score (aim for 20% savings rate)
            score = min(100, savings_rate * 500)  # 20% savings = 100 score
            return max(0, score)
        
        return 0.0 if expenses > 0 else 50.0
    
    def _calculate_category_balance(self) -> float:
        """Score based on balanced spending across categories"""
        # Get spending by category for last 30 days
        start_date = date.today() - timedelta(days=30)
        
        transactions = self.session.exec(
            select(Tx).where(
                Tx.user_id == self.user_id,
                Tx.tx_date >= start_date,
                Tx.amount < 0
            )
        ).all()
        
        if len(transactions) < 10:
            return 50.0
        
        category_spending = defaultdict(float)
        total_spending = 0
        
        for tx in transactions:
            amount = abs(tx.amount)
            category_spending[tx.label] += amount
            total_spending += amount
        
        if total_spending == 0 or len(category_spending) < 2:
            return 50.0
        
        # Calculate entropy (higher entropy = more balanced)
        entropy = 0
        for amount in category_spending.values():
            proportion = amount / total_spending
            if proportion > 0:
                entropy -= proportion * np.log(proportion)
        
        # Normalize entropy to 0-100 scale
        max_entropy = np.log(len(category_spending))
        if max_entropy > 0:
            normalized_entropy = entropy / max_entropy
            return min(100, normalized_entropy * 100)
        
        return 50.0
    
    def __del__(self):
        self.session.close()