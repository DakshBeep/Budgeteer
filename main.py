# uvicorn main:app --reload

from __future__ import annotations

from datetime import date, timedelta, datetime
import pandas as pd  # for recurring date offsets
from typing import Optional, List
import jwt

from passlib.context import CryptContext
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from models.forecasting import catboost_predict, neuralprophet_predict
import numpy as np
from fastapi import FastAPI, Depends, Header
from sqlmodel import SQLModel, Field, Session, create_engine, select
from fastapi import HTTPException

app = FastAPI()
engine = create_engine("sqlite:///budgeteer.db", echo=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = "budgeteer-secret"
JWT_ALGORITHM = "HS256"


def get_current_user(authorization: str = Header(None)) -> User:
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
    tx = Tx(**tx_in.model_dump(), user_id=user.id)
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
                )
                s.add(future_tx)
        s.commit()
        s.refresh(tx)
        return tx

@app.get("/tx", response_model=List[Tx])
def list_tx(user: User = Depends(get_current_user)) -> List[Tx]:
    with Session(engine) as s:
        stmt = select(Tx).where(Tx.user_id == user.id)
        return s.exec(stmt).all()     # <-- LIST of objects
# ---------------------------------------------------------------------
@app.delete("/tx/{tx_id}", status_code=204)
def delete_tx(tx_id: int, user: User = Depends(get_current_user)) -> None:
    with Session(engine) as s:
        tx = s.get(Tx, tx_id)
        if not tx or tx.user_id != user.id:
            raise HTTPException(status_code=404, detail="Not found")
        s.delete(tx)
        s.commit()


@app.get("/reminders", response_model=List[Tx])
def get_reminders(days: int = 30, user: User = Depends(get_current_user)) -> List[Tx]:
    """Return upcoming recurring transactions within ``days`` days."""
    cutoff = date.today() + timedelta(days=days)
    with Session(engine) as s:
        stmt = select(Tx).where(
            Tx.user_id == user.id,
            Tx.recurring == True,
            Tx.tx_date > date.today(),
            Tx.tx_date <= cutoff,
        )
        return s.exec(stmt).all()


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

        df = pd.DataFrame(
            [{"tx_date": t.tx_date, "amount": t.amount} for t in txs]
        )
        df = df.groupby("tx_date")["amount"].sum().sort_index()
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
