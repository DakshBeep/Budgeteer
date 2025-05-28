"""
Background scheduler for periodic tasks like insight generation
"""
from datetime import datetime, timedelta
import asyncio
import logging
from sqlmodel import Session, select
from database import engine
from dbmodels import User, UserPreferences
try:
    from insights_engine import InsightsGenerator
    from insights import generate_user_insights_task
    from email_service import EmailService
    INSIGHTS_AVAILABLE = True
except ImportError:
    INSIGHTS_AVAILABLE = False
    logger.warning("Insights modules not available")

logger = logging.getLogger(__name__)


class InsightScheduler:
    """Manages scheduled generation of insights"""
    
    def __init__(self):
        self.running = False
        self.email_service = EmailService()
        
    async def start(self):
        """Start the scheduler"""
        self.running = True
        logger.info("Insight scheduler started")
        
        # Wait a bit before starting to let the app initialize
        await asyncio.sleep(30)
        
        while self.running:
            try:
                await self.generate_scheduled_insights()
                # Run every hour
                await asyncio.sleep(3600)
            except Exception as e:
                logger.error(f"Error in scheduler: {e}")
                await asyncio.sleep(60)  # Retry after 1 minute
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        logger.info("Insight scheduler stopped")
    
    async def generate_scheduled_insights(self):
        """Generate insights for all users based on their preferences"""
        with Session(engine) as session:
            # Get all users
            users = session.exec(select(User)).all()
            
            for user in users:
                try:
                    # Check user preferences
                    prefs = session.exec(
                        select(UserPreferences).where(
                            UserPreferences.user_id == user.id
                        )
                    ).first()
                    
                    # Skip if user has disabled insights
                    if prefs and prefs.email_digest_frequency == "never":
                        continue
                    
                    # Generate insights
                    logger.info(f"Generating insights for user {user.id}")
                    generate_user_insights_task(user.id)
                    
                except Exception as e:
                    logger.error(f"Error generating insights for user {user.id}: {e}")
    
    async def send_digest_emails(self):
        """Send digest emails based on user preferences"""
        current_time = datetime.utcnow()
        current_hour = current_time.hour
        current_day = current_time.weekday()  # 0 = Monday
        
        with Session(engine) as session:
            # Get users with email preferences
            users_with_prefs = session.exec(
                select(User, UserPreferences).join(UserPreferences)
            ).all()
            
            for user, prefs in users_with_prefs:
                try:
                    # Skip if outside quiet hours
                    if prefs.quiet_hours_start and prefs.quiet_hours_end:
                        if prefs.quiet_hours_start <= current_hour < prefs.quiet_hours_end:
                            continue
                    
                    # Check frequency
                    should_send = False
                    
                    if prefs.email_digest_frequency == "daily":
                        should_send = True
                    elif prefs.email_digest_frequency == "weekly" and current_day == 0:  # Monday
                        should_send = True
                    elif prefs.email_digest_frequency == "monthly" and current_time.day == 1:
                        should_send = True
                    
                    if should_send and "email" in prefs.notification_types:
                        # Send digest email
                        logger.info(f"Sending {prefs.email_digest_frequency} digest to user {user.id}")
                        self.email_service.send_digest(session, user, prefs.email_digest_frequency)
                        
                except Exception as e:
                    logger.error(f"Error processing digest for user {user.id}: {e}")


# Create a simple wrapper for FastAPI startup
scheduler = InsightScheduler()

async def start_scheduler():
    """Start the scheduler in the background"""
    asyncio.create_task(scheduler.start())