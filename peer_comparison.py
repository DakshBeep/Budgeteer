"""
Peer comparison service for anonymized spending benchmarks
"""
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select, func
from dbmodels import User, Tx, SpendingBenchmark
import logging

logger = logging.getLogger(__name__)


class PeerComparisonService:
    """Service for comparing user spending against anonymized peer data"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def update_benchmarks(self, demographic: str = "all_users"):
        """Update spending benchmarks for a demographic group"""
        try:
            # Get date range (last 30 days)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            # Get all active users
            users = self.session.exec(select(User)).all()
            
            if len(users) < 5:  # Need minimum users for anonymity
                logger.info("Not enough users for peer comparison")
                return
            
            # Calculate benchmarks by category
            categories = [
                "food", "entertainment", "shopping", "transport", 
                "education", "utilities", "health", "personal"
            ]
            
            for category in categories:
                # Get spending data for this category across all users
                spending_data = self.session.exec(
                    select(
                        Tx.user_id,
                        func.sum(func.abs(Tx.amount)).label("total")
                    ).where(
                        Tx.tx_date >= start_date,
                        Tx.tx_date <= end_date,
                        Tx.label == category,
                        Tx.amount < 0
                    ).group_by(Tx.user_id)
                ).all()
                
                if not spending_data:
                    continue
                
                # Calculate statistics
                amounts = [data.total for _, data in spending_data if data.total]
                if len(amounts) < 5:  # Need minimum data points
                    continue
                
                amounts.sort()
                count = len(amounts)
                
                # Calculate percentiles
                p10_idx = int(count * 0.1)
                p25_idx = int(count * 0.25)
                p50_idx = int(count * 0.5)
                p75_idx = int(count * 0.75)
                p90_idx = int(count * 0.9)
                
                benchmark_data = {
                    "mean": sum(amounts) / count,
                    "median": amounts[p50_idx],
                    "p10": amounts[p10_idx],
                    "p25": amounts[p25_idx],
                    "p75": amounts[p75_idx],
                    "p90": amounts[p90_idx],
                    "min": amounts[0],
                    "max": amounts[-1],
                    "user_count": count
                }
                
                # Check if benchmark exists
                existing = self.session.exec(
                    select(SpendingBenchmark).where(
                        SpendingBenchmark.category == category,
                        SpendingBenchmark.user_demographic == demographic
                    )
                ).first()
                
                if existing:
                    # Update existing benchmark
                    existing.average_percentage = benchmark_data["mean"] / 1000 * 100  # Rough estimate
                    existing.median_amount = benchmark_data["median"]
                    existing.benchmark_data = benchmark_data
                    existing.updated_at = datetime.utcnow()
                else:
                    # Create new benchmark
                    benchmark = SpendingBenchmark(
                        category=category,
                        user_demographic=demographic,
                        average_percentage=benchmark_data["mean"] / 1000 * 100,  # Rough estimate
                        median_amount=benchmark_data["median"],
                        benchmark_data=benchmark_data,
                        updated_at=datetime.utcnow()
                    )
                    self.session.add(benchmark)
            
            self.session.commit()
            logger.info(f"Updated benchmarks for {demographic}")
            
        except Exception as e:
            logger.error(f"Failed to update benchmarks: {str(e)}")
            self.session.rollback()
    
    def get_user_comparison(self, user_id: int) -> Dict:
        """Get user's spending compared to peers"""
        try:
            # Get user's spending by category (last 30 days)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            user_spending = self.session.exec(
                select(
                    Tx.label,
                    func.sum(func.abs(Tx.amount)).label("total")
                ).where(
                    Tx.user_id == user_id,
                    Tx.tx_date >= start_date,
                    Tx.tx_date <= end_date,
                    Tx.amount < 0
                ).group_by(Tx.label)
            ).all()
            
            comparisons = []
            
            for category, amount in user_spending:
                if not category:
                    continue
                
                # Get benchmark for this category
                benchmark = self.session.exec(
                    select(SpendingBenchmark).where(
                        SpendingBenchmark.category == category,
                        SpendingBenchmark.user_demographic == "all_users"
                    )
                ).first()
                
                if not benchmark:
                    continue
                
                data = benchmark.benchmark_data
                
                # Calculate user's percentile
                percentile = self._calculate_percentile(amount, data)
                
                # Determine status
                if amount <= data["p25"]:
                    status = "excellent"
                    message = "You're spending less than 75% of your peers!"
                elif amount <= data["median"]:
                    status = "good"
                    message = "You're spending less than most peers."
                elif amount <= data["p75"]:
                    status = "average"
                    message = "Your spending is typical for this category."
                else:
                    status = "high"
                    message = "You're spending more than 75% of your peers."
                
                comparisons.append({
                    "category": category,
                    "user_amount": amount,
                    "peer_median": data["median"],
                    "peer_mean": data["mean"],
                    "percentile": percentile,
                    "status": status,
                    "message": message,
                    "peer_range": {
                        "low": data["p25"],
                        "high": data["p75"]
                    }
                })
            
            # Calculate overall score
            if comparisons:
                avg_percentile = sum(c["percentile"] for c in comparisons) / len(comparisons)
                overall_status = "excellent" if avg_percentile <= 25 else \
                                "good" if avg_percentile <= 50 else \
                                "average" if avg_percentile <= 75 else "high"
            else:
                avg_percentile = 50
                overall_status = "no_data"
            
            return {
                "overall_percentile": avg_percentile,
                "overall_status": overall_status,
                "comparisons": comparisons,
                "last_updated": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Failed to get user comparison: {str(e)}")
            return {
                "error": "Failed to generate comparison",
                "comparisons": []
            }
    
    def _calculate_percentile(self, value: float, benchmark_data: Dict) -> float:
        """Calculate percentile rank for a value"""
        if value <= benchmark_data["p10"]:
            return 10
        elif value <= benchmark_data["p25"]:
            return 25
        elif value <= benchmark_data["median"]:
            return 50
        elif value <= benchmark_data["p75"]:
            return 75
        elif value <= benchmark_data["p90"]:
            return 90
        else:
            return 95
    
    def get_savings_opportunities(self, user_id: int) -> List[Dict]:
        """Identify categories where user could save based on peer data"""
        comparison = self.get_user_comparison(user_id)
        opportunities = []
        
        for comp in comparison.get("comparisons", []):
            if comp["status"] == "high":
                potential_savings = comp["user_amount"] - comp["peer_median"]
                opportunities.append({
                    "category": comp["category"],
                    "current_spending": comp["user_amount"],
                    "peer_median": comp["peer_median"],
                    "potential_monthly_savings": potential_savings,
                    "potential_annual_savings": potential_savings * 12,
                    "recommendation": f"Try to reduce {comp['category']} spending by "
                                    f"${potential_savings:.0f}/month to match typical peers"
                })
        
        # Sort by potential savings
        opportunities.sort(key=lambda x: x["potential_monthly_savings"], reverse=True)
        
        return opportunities