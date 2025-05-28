from datetime import timedelta, date
import os
from typing import List
from functools import lru_cache

import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, create_engine

from dbmodels import Tx, BudgetGoal
from auth import get_current_user
try:
    from models.forecasting import catboost_predict, neuralprophet_predict
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("Warning: ML libraries not available, using simple forecasting")

# Import shared engine to avoid circular import
from database import engine

router = APIRouter()


def _forecast_cached(user_id: int, days: int, model: str, last_ts: float):
    with Session(engine) as s:
        txs = s.exec(select(Tx).where(Tx.user_id == user_id)).all()
        df = pd.DataFrame([{"tx_date": t.tx_date, "amount": t.amount} for t in txs])
        df = df.groupby("tx_date")["amount"].sum().sort_index()
        df.index = pd.to_datetime(df.index)
        running = df.cumsum()

        base = running.index.min()
        
        if not ML_AVAILABLE or len(running) < 7:
            # Simple linear projection if ML not available or insufficient data
            if len(running) < 2:
                return running.iloc[-1] if len(running) > 0 else 0
            
            # Calculate average daily change over last 7 days
            recent_days = min(7, len(running) - 1)
            daily_change = (running.iloc[-1] - running.iloc[-recent_days-1]) / recent_days
            return running.iloc[-1] + (daily_change * days)
        
        idx = (pd.to_datetime(running.index) - pd.Timestamp(base)).days.values.reshape(
            -1, 1
        )

        last_idx = int(idx[-1][0])
        last_date = running.index.max()
        future_dates = [last_date + timedelta(days=i) for i in range(1, days + 1)]
        future_idx = [[last_idx + i] for i in range(1, days + 1)]

        if model == "rf":
            from sklearn.ensemble import RandomForestRegressor

            reg = RandomForestRegressor(n_estimators=100)
            reg.fit(idx, running.values)
            preds = reg.predict(future_idx)
        elif model == "catboost":
            preds = catboost_predict(idx, running.values, future_idx)
        elif model == "neuralprophet":
            preds = neuralprophet_predict(running, future_dates)
        elif model == "mc":
            daily = running.diff().fillna(running.iloc[0])
            mu = float(daily.mean())
            sigma = float(daily.std()) if daily.std() else 0.0
            last_balance = float(running.iloc[-1])
            sims = []
            for _ in range(100):
                steps = np.random.normal(mu, sigma, days)
                sims.append(np.cumsum(steps) + last_balance)
            preds = np.mean(sims, axis=0)
        else:
            from sklearn.linear_model import LinearRegression

            reg = LinearRegression()
            reg.fit(idx, running.values)
            preds = reg.predict(future_idx)

        return [
            {"tx_date": d.isoformat(), "predicted_balance": float(p)}
            for d, p in zip(future_dates, preds)
        ]


@lru_cache(maxsize=32)
def cached_forecast(user_id: int, days: int, model: str, last_ts: float):
    return tuple(_forecast_cached(user_id, days, model, last_ts))


@router.get("/forecast")
def get_forecast(days: int = 7, model: str = "linear", user=Depends(get_current_user)):
    with Session(engine) as s:
        txs = s.exec(select(Tx).where(Tx.user_id == user.id)).all()
        if not txs:
            raise HTTPException(status_code=404, detail="No transactions")
        last_ts = max(t.tx_date for t in txs).toordinal()
    result = cached_forecast(user.id, days, model, last_ts)
    return list(result)


@router.get("/goal")
def get_goal(user=Depends(get_current_user)):
    month_start = date.today().replace(day=1)
    with Session(engine) as s:
        goal = s.exec(
            select(BudgetGoal).where(
                BudgetGoal.user_id == user.id,
                BudgetGoal.month == month_start,
            )
        ).first()
        spent = s.exec(
            select(Tx).where(
                Tx.user_id == user.id,
                Tx.tx_date >= month_start,
                Tx.amount < 0,
            )
        ).all()
        total_spent = sum(abs(t.amount) for t in spent)
        if goal:
            return {
                "month": month_start.isoformat(),
                "amount": goal.amount,
                "spent": total_spent,
            }
        return {"month": month_start.isoformat(), "amount": 0.0, "spent": total_spent}


@router.post("/goal")
def set_goal(amount: float, user=Depends(get_current_user)):
    month_start = date.today().replace(day=1)
    with Session(engine) as s:
        goal = s.exec(
            select(BudgetGoal).where(
                BudgetGoal.user_id == user.id,
                BudgetGoal.month == month_start,
            )
        ).first()
        if goal:
            goal.amount = amount
        else:
            goal = BudgetGoal(month=month_start, amount=amount, user_id=user.id)
            s.add(goal)
        s.commit()
        return {"month": month_start.isoformat(), "amount": amount}
