"""
Email service for sending financial insights digests
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import os
from jinja2 import Template
from sqlmodel import Session, select
from dbmodels import User, Tx, Insight, UserPreferences, FinancialHealthScore
from insights_engine import InsightsGenerator
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self, smtp_host: str = None, smtp_port: int = None, 
                 smtp_user: str = None, smtp_password: str = None):
        """Initialize email service with SMTP configuration"""
        self.smtp_host = smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = smtp_port or int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = smtp_user or os.getenv("SMTP_USER")
        self.smtp_password = smtp_password or os.getenv("SMTP_PASSWORD")
        
        if not all([self.smtp_host, self.smtp_port, self.smtp_user, self.smtp_password]):
            logger.warning("Email service not fully configured. Email sending will be disabled.")
            self.enabled = False
        else:
            self.enabled = True
    
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send an email"""
        if not self.enabled:
            logger.info(f"Email service disabled. Would send to {to_email}: {subject}")
            return False
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_user
            msg['To'] = to_email
            
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def create_digest_html(self, user: User, period: str, data: Dict) -> str:
        """Create HTML content for digest email"""
        template = Template("""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
                .stat-card { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .insight { background: #fef3c7; padding: 12px; margin: 8px 0; border-left: 4px solid #f59e0b; border-radius: 4px; }
                .alert { background: #fee2e2; padding: 12px; margin: 8px 0; border-left: 4px solid #ef4444; border-radius: 4px; }
                .success { background: #d1fae5; padding: 12px; margin: 8px 0; border-left: 4px solid #10b981; border-radius: 4px; }
                .button { display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; }
                h1, h2, h3 { margin: 0 0 10px 0; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Your {{ period }} Financial Digest</h1>
                    <p>{{ user.username }}, here's your financial summary for {{ date_range }}</p>
                </div>
                
                <div class="content">
                    <!-- Financial Health Score -->
                    <div class="stat-card">
                        <h2>Financial Health Score: {{ health_score }}%</h2>
                        <p>{{ health_message }}</p>
                    </div>
                    
                    <!-- Spending Summary -->
                    <div class="stat-card">
                        <h3>Spending Summary</h3>
                        <p>Total Spent: ${{ total_spent }}</p>
                        <p>Total Income: ${{ total_income }}</p>
                        <p>Net: <span style="color: {{ 'green' if net_amount >= 0 else 'red' }}">
                            ${{ net_amount }}</span></p>
                    </div>
                    
                    <!-- Top Categories -->
                    <div class="stat-card">
                        <h3>Top Spending Categories</h3>
                        {% for cat in top_categories %}
                        <p>{{ cat.category }}: ${{ cat.amount }} ({{ cat.percentage }}%)</p>
                        {% endfor %}
                    </div>
                    
                    <!-- Key Insights -->
                    {% if insights %}
                    <h3>Key Insights</h3>
                    {% for insight in insights %}
                    <div class="{{ insight.class }}">
                        <strong>{{ insight.title }}</strong>
                        <p>{{ insight.description }}</p>
                    </div>
                    {% endfor %}
                    {% endif %}
                    
                    <!-- Budget Progress -->
                    {% if budget_status %}
                    <div class="stat-card">
                        <h3>Budget Status</h3>
                        <p>{{ budget_status.message }}</p>
                        <p>Used: ${{ budget_status.spent }} / ${{ budget_status.limit }}</p>
                        <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
                            <div style="background: {{ budget_status.color }}; height: 100%; width: {{ budget_status.percentage }}%;"></div>
                        </div>
                    </div>
                    {% endif %}
                    
                    <!-- Call to Action -->
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{{ app_url }}" class="button">View Full Dashboard</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>You're receiving this because you've enabled {{ period }} digest emails.</p>
                    <p><a href="{{ unsubscribe_url }}">Unsubscribe</a> | <a href="{{ settings_url }}">Update Preferences</a></p>
                </div>
            </div>
        </body>
        </html>
        """)
        
        return template.render(**data)
    
    def prepare_digest_data(self, session: Session, user: User, period: str) -> Dict:
        """Prepare data for digest email"""
        # Calculate date range
        end_date = datetime.now()
        if period == "weekly":
            start_date = end_date - timedelta(days=7)
            date_range = f"Week of {start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"
        else:  # monthly
            start_date = end_date - timedelta(days=30)
            date_range = f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"
        
        # Get transactions
        transactions = session.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.date >= start_date,
                Tx.date <= end_date
            )
        ).all()
        
        # Calculate totals
        total_spent = sum(t.amount for t in transactions if t.amount < 0)
        total_income = sum(t.amount for t in transactions if t.amount > 0)
        net_amount = total_income + total_spent  # spent is negative
        
        # Get top categories
        category_totals = {}
        for t in transactions:
            if t.amount < 0 and t.category:
                category_totals[t.category] = category_totals.get(t.category, 0) + abs(t.amount)
        
        sorted_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:5]
        top_categories = [
            {
                "category": cat,
                "amount": f"{amount:.2f}",
                "percentage": f"{(amount / abs(total_spent) * 100):.1f}" if total_spent else "0"
            }
            for cat, amount in sorted_categories
        ]
        
        # Get latest health score
        health_score = session.exec(
            select(FinancialHealthScore).where(
                FinancialHealthScore.user_id == user.id
            ).order_by(FinancialHealthScore.calculated_at.desc())
        ).first()
        
        if health_score:
            score_value = health_score.score
            if score_value >= 80:
                health_message = "Excellent! You're doing great with your finances."
            elif score_value >= 60:
                health_message = "Good job! There's some room for improvement."
            else:
                health_message = "Needs attention. Consider reviewing your spending habits."
        else:
            score_value = 0
            health_message = "No health score available yet."
        
        # Get recent insights
        recent_insights = session.exec(
            select(Insight).where(
                Insight.user_id == user.id,
                Insight.created_at >= start_date
            ).order_by(Insight.priority.desc()).limit(5)
        ).all()
        
        insights_data = []
        for insight in recent_insights:
            class_name = "alert" if insight.priority == "high" else "insight"
            if "saving" in insight.title.lower() or "under budget" in insight.title.lower():
                class_name = "success"
            
            insights_data.append({
                "title": insight.title,
                "description": insight.description,
                "class": class_name
            })
        
        # Get budget status
        # (Assuming we have budget data in user preferences or a separate table)
        budget_status = None
        # TODO: Implement budget checking logic
        
        return {
            "user": user,
            "period": period,
            "date_range": date_range,
            "health_score": score_value,
            "health_message": health_message,
            "total_spent": f"{abs(total_spent):.2f}",
            "total_income": f"{total_income:.2f}",
            "net_amount": f"{net_amount:.2f}",
            "top_categories": top_categories,
            "insights": insights_data,
            "budget_status": budget_status,
            "app_url": os.getenv("FRONTEND_URL", "http://localhost:5173"),
            "unsubscribe_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/settings",
            "settings_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/settings"
        }
    
    def send_digest(self, session: Session, user: User, period: str = "weekly") -> bool:
        """Send a digest email to a user"""
        try:
            # Check if user has email digests enabled
            preferences = session.exec(
                select(UserPreferences).where(UserPreferences.user_id == user.id)
            ).first()
            
            if not preferences:
                logger.info(f"No preferences found for user {user.id}")
                return False
            
            if period == "weekly" and not preferences.weekly_digest_enabled:
                logger.info(f"Weekly digest not enabled for user {user.id}")
                return False
            elif period == "monthly" and not preferences.monthly_summary_enabled:
                logger.info(f"Monthly summary not enabled for user {user.id}")
                return False
            
            # Prepare digest data
            data = self.prepare_digest_data(session, user, period)
            
            # Create HTML content
            html_content = self.create_digest_html(user, period, data)
            
            # Send email
            subject = f"Your {period.capitalize()} Budgeteer Financial Digest"
            return self.send_email(user.email, subject, html_content)
            
        except Exception as e:
            logger.error(f"Failed to send {period} digest to user {user.id}: {str(e)}")
            return False
    
    def send_all_digests(self, session: Session, period: str = "weekly"):
        """Send digests to all users who have enabled them"""
        users = session.exec(select(User)).all()
        
        sent_count = 0
        for user in users:
            if self.send_digest(session, user, period):
                sent_count += 1
        
        logger.info(f"Sent {sent_count} {period} digest emails")
        return sent_count