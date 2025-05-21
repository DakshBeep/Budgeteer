# uvicorn main:app --reload

from datetime import date, timedelta, datetime
import os
import pandas as pd  # for recurring date offsets
from typing import Optional, List
import jwt
import logging
from functools import lru_cache

from passlib.context import CryptContext
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from models.forecasting import catboost_predict, neuralprophet_predict
import numpy as np
from fastapi import FastAPI, Depends, Header, Body
from sqlmodel import SQLModel, Field, Session, create_engine, select
from pydantic import root_validator
from fastapi import HTTPException

app = FastAPI()
db_url = os.getenv("DATABASE_URL", "sqlite:///budgeteer.db")
engine = create_engine(db_url, echo=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "budgeteer-secret")
JWT_ALGORITHM = "HS256"


def get_current_user(authorization: str = Header(None)) -> "User":
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer", "").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

# ------------ Models -------------------------------------------------
class TxIn(SQLModel):                 # <- used only for incoming JSON
    tx_date: date
    amount: float
    label: str
    recurring: bool = False

    @root_validator
    def check_values(cls, values):
        if values.get("amount") == 0:
            raise ValueError("amount must not be zero")
        if (
            not values.get("recurring")
            and values.get("tx_date") > date.today()
        ):
            raise ValueError("tx_date cannot be in the future for non-recurring entries")
        return values

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str

class Tx(SQLModel, table=True):       # <- ORM table + outward schema
    id: Optional[int] = Field(default=None, primary_key=True)
    tx_date: date
    amount: float
    label: str
    recurring: bool = False
    series_id: Optional[int] = Field(default=None, index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")

class BudgetGoal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    month: date
    amount: float
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
# ---------------------------------------------------------------------

@app.on_event("startup")
def init_db() -> None:
    SQLModel.metadata.create_all(engine)

# ---------- Endpoints ------------------------------------------------


@app.post("/register")
def register(username: str, password: str):
    with Session(engine) as s:
        existing = s.exec(select(User).where(User.username == username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username taken")
        user = User(username=username, password_hash=pwd_context.hash(password))
        s.add(user)
        s.commit()
        s.refresh(user)
        return {"id": user.id, "username": user.username}


@app.post("/login")
def login(username: str, password: str):
    with Session(engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        if not user or not pwd_context.verify(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        payload = {
            "user_id": user.id,
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return {"token": token}


@app.get("/me")
def whoami(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}


@app.post("/tx", response_model=Tx)
def add_tx(tx_in: TxIn, user: User = Depends(get_current_user)) -> Tx:
    logger.info("add_tx user=%s", user.username)
    series_id = int(datetime.utcnow().timestamp()) if tx_in.recurring else None
    tx = Tx(**tx_in.model_dump(), user_id=user.id, series_id=series_id)
    with Session(engine) as s:
        s.add(tx)
        if tx_in.recurring:
            for i in range(1, 4):
                future_date = (
                    pd.Timestamp(tx_in.tx_date) + pd.DateOffset(months=i)
                ).date()
                future_tx = Tx(
                    tx_date=future_date,
                    amount=tx_in.amount,
                    label=tx_in.label,
                    recurring=True,
                    user_id=user.id,
                    series_id=series_id,
                )
                s.add(future_tx)
        s.commit()
        s.refresh(tx)
        return tx

def _extend_recurring(user: User, s: Session, months: int = 3) -> None:
    """Ensure each recurring series has ``months`` future entries."""
    today = date.today()
    series_ids = s.exec(
        select(Tx.series_id)
        .where(Tx.user_id == user.id, Tx.recurring == True, Tx.series_id != None)
        .distinct()
    ).all()
    for sid in series_ids:
        txs = (
            s.exec(
                select(Tx)
                .where(Tx.series_id == sid, Tx.user_id == user.id)
                .order_by(Tx.tx_date)
            ).all()
        )
        if not txs:
            continue
        future_count = len([t for t in txs if t.tx_date > today])
        last_tx = txs[-1]
        last_date = last_tx.tx_date
        while future_count < months:
            last_date = (pd.Timestamp(last_date) + pd.DateOffset(months=1)).date()
            future_tx = Tx(
                tx_date=last_date,
                amount=last_tx.amount,
                label=last_tx.label,
                recurring=True,
                user_id=user.id,
                series_id=sid,
            )
            s.add(future_tx)
            last_tx = future_tx
            future_count += 1
    if series_ids:
        s.commit()

@app.get("/tx", response_model=List[Tx])
def list_tx(user: User = Depends(get_current_user)) -> List[Tx]:
    with Session(engine) as s:
        _extend_recurring(user, s)
        stmt = select(Tx).where(Tx.user_id == user.id).order_by(Tx.tx_date.desc())
        return s.exec(stmt).all()


@app.put("/tx/{tx_id}", response_model=Tx)
def update_tx(
    tx_id: int,
    tx_in: TxIn,
    propagate: bool = False,
    user: User = Depends(get_current_user),
) -> Tx:
    with Session(engine) as s:
        logger.info("update_tx user=%s id=%s", user.username, tx_id)
        tx = s.get(Tx, tx_id)
        if not tx or tx.user_id != user.id:
            raise HTTPException(status_code=404, detail="Not found")
        # handle change in recurring flag
        if tx.recurring and not tx_in.recurring:
            stmt = select(Tx).where(
                Tx.series_id == tx.series_id,
                Tx.user_id == user.id,
                Tx.tx_date > tx.tx_date,
            )
            for f in s.exec(stmt).all():
                s.delete(f)
            tx.series_id = None
        elif tx_in.recurring and not tx.recurring:
            new_series = int(datetime.utcnow().timestamp())
            tx.series_id = new_series
            for i in range(1, 4):
                future_date = (
                    pd.Timestamp(tx_in.tx_date) + pd.DateOffset(months=i)
                ).date()
                future_tx = Tx(
                    tx_date=future_date,
                    amount=tx_in.amount,
                    label=tx_in.label,
                    recurring=True,
                    user_id=user.id,
                    series_id=new_series,
                )
                s.add(future_tx)
        old_date = tx.tx_date
        delta = tx_in.tx_date - old_date
        tx.tx_date = tx_in.tx_date
        tx.amount = tx_in.amount
        tx.label = tx_in.label
        tx.recurring = tx_in.recurring
        if propagate and tx.series_id and tx.recurring:
            stmt = select(Tx).where(
                Tx.series_id == tx.series_id,
                Tx.user_id == user.id,
                Tx.tx_date > old_date,
            )
            for f in s.exec(stmt).all():
                f.amount = tx_in.amount
                f.label = tx_in.label
                f.tx_date = f.tx_date + delta
                s.add(f)
        s.add(tx)
        s.commit()
        s.refresh(tx)
        return tx
# ---------------------------------------------------------------------
@app.delete("/tx/{tx_id}", status_code=204)
def delete_tx(tx_id: int, user: User = Depends(get_current_user)) -> None:
    with Session(engine) as s:
        logger.info("delete_tx user=%s id=%s", user.username, tx_id)
        tx = s.get(Tx, tx_id)
        if not tx or tx.user_id != user.id:
            raise HTTPException(status_code=404, detail="Not found")
        if tx.series_id:
            stmt = select(Tx).where(
                Tx.series_id == tx.series_id,
                Tx.user_id == user.id,
                Tx.tx_date >= tx.tx_date,
            )
            for f in s.exec(stmt).all():
                s.delete(f)
        else:
            s.delete(tx)
        s.commit()


@app.get("/reminders", response_model=List[Tx])
def get_reminders(days: int = 30, user: User = Depends(get_current_user)) -> List[Tx]:
    """Return upcoming recurring transactions within ``days`` days."""
    cutoff = date.today() + timedelta(days=days)
    with Session(engine) as s:
        _extend_recurring(user, s)
        stmt = select(Tx).where(
            Tx.user_id == user.id,
            Tx.recurring == True,
            Tx.tx_date > date.today(),
            Tx.tx_date <= cutoff,
        )
        return s.exec(stmt).all()


def _forecast_cached(user_id: int, days: int, model: str, last_ts: float):
    with Session(engine) as s:
        txs = s.exec(select(Tx).where(Tx.user_id == user_id)).all()
        df = pd.DataFrame(
            [{"tx_date": t.tx_date, "amount": t.amount} for t in txs]
        )
        df = df.groupby("tx_date")["amount"].sum().sort_index()
        df.index = pd.to_datetime(df.index)
        running = df.cumsum()

        base = running.index.min()
        idx = (running.index - base).days.values.reshape(-1, 1)

        last_idx = int(idx[-1][0])
        last_date = running.index.max()
        future_dates = [last_date + timedelta(days=i) for i in range(1, days + 1)]
        future_idx = [[last_idx + i] for i in range(1, days + 1)]

        if model == "rf":
            reg = RandomForestRegressor(n_estimators=200)
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


@app.get("/forecast")
def get_forecast(
    days: int = 7,
    model: str = "linear",
    user: User = Depends(get_current_user),
):
    """Return predicted running balance for the next ``days`` days.

    Parameters
    ----------
    days: int
        Number of future days to forecast.
    model: str
        Which model to use: ``"linear"``, ``"rf"`` (Random Forest),
        ``"mc"`` (Monte Carlo), ``"catboost"`` or ``"neuralprophet``.
    """
    with Session(engine) as s:
        txs = s.exec(select(Tx).where(Tx.user_id == user.id)).all()
        if not txs:
            raise HTTPException(status_code=404, detail="No transactions")
        last_ts = max(t.tx_date for t in txs).toordinal()
    result = cached_forecast(user.id, days, model, last_ts)
    return list(result)


@app.get("/goal")
def get_goal(user: User = Depends(get_current_user)):
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
        return {
            "month": month_start.isoformat(),
            "amount": 0.0,
            "spent": total_spent,
        }


@app.post("/goal")
def set_goal(amount: float, user: User = Depends(get_current_user)):
    month_start = date.today().replace(day=1)
    with Session(engine) as s:
        logger.info("set_goal user=%s", user.username)
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


@app.post("/change_password")
def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    user: User = Depends(get_current_user),
):
    """Allow authenticated users to change their password."""
    with Session(engine) as s:
        db_user = s.get(User, user.id)
        if not pwd_context.verify(current_password, db_user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect current password")
        db_user.password_hash = pwd_context.hash(new_password)
        s.add(db_user)
        s.commit()
        return {"status": "ok"}
