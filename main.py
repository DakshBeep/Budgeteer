# uvicorn main:app --reload

from datetime import date, timedelta
from typing import Optional, List
import hashlib
import uuid
import pandas as pd
from sklearn.linear_model import LinearRegression
from fastapi import FastAPI, Depends, Header
from sqlmodel import SQLModel, Field, Session, create_engine, select
from fastapi import HTTPException

app = FastAPI()
engine = create_engine("sqlite:///budgeteer.db", echo=False)

tokens: dict[str, int] = {}


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def authenticate_user(username: str, password: str) -> Optional['User']:
    with Session(engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        if user and user.password_hash == hash_password(password):
            return user
    return None


def get_current_user(authorization: str = Header(...)) -> 'User':
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split()[1]
    user_id = tokens.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user

# ------------ Models -------------------------------------------------
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, sa_column_kwargs={"unique": True})
    password_hash: str


class TxIn(SQLModel):                 # <- used only for incoming JSON
    tx_date: date
    amount: float
    label: str

class UserIn(SQLModel):
    username: str
    password: str

class Tx(SQLModel, table=True):       # <- ORM table + outward schema
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    tx_date: date
    amount: float
    label: str
# ---------------------------------------------------------------------

@app.on_event("startup")
def init_db() -> None:
    SQLModel.metadata.create_all(engine)

# ---------- Endpoints ------------------------------------------------
@app.post("/register")
def register(user_in: UserIn):
    with Session(engine) as s:
        existing = s.exec(select(User).where(User.username == user_in.username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username taken")
        user = User(username=user_in.username, password_hash=hash_password(user_in.password))
        s.add(user)
        s.commit()
        s.refresh(user)
        return {"message": "registered"}


@app.post("/login")
def login(user_in: UserIn):
    user = authenticate_user(user_in.username, user_in.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = uuid.uuid4().hex
    tokens[token] = user.id
    return {"token": token}


@app.post("/logout")
def logout(current_user: User = Depends(get_current_user), authorization: str = Header(...)):
    token = authorization.split()[1]
    tokens.pop(token, None)
    return {"message": "logged out"}


@app.post("/tx", response_model=Tx)
def add_tx(tx_in: TxIn, current_user: User = Depends(get_current_user)) -> Tx:
    tx_data = tx_in.dict()  # convert Pydantic model to plain dict
    tx = Tx(**tx_data, user_id=current_user.id)           # cast JSON -> ORM object
    with Session(engine) as s:
        s.add(tx)
        s.commit()
        s.refresh(tx)
        return tx                           # <-- SINGLE object

@app.get("/tx", response_model=List[Tx])
def list_tx(current_user: User = Depends(get_current_user)) -> List[Tx]:
    with Session(engine) as s:
        statement = select(Tx).where(Tx.user_id == current_user.id)
        return s.exec(statement).all()     # <-- LIST of objects
# ---------------------------------------------------------------------
@app.delete("/tx/{tx_id}", status_code=204)
def delete_tx(tx_id: int, current_user: User = Depends(get_current_user)) -> None:
    with Session(engine) as s:
        tx = s.get(Tx, tx_id)
        if not tx or tx.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Not found")
        s.delete(tx)
        s.commit()


@app.get("/forecast")
def get_forecast(days: int = 7, current_user: User = Depends(get_current_user)):
    """Return predicted running balance for the next ``days`` days."""
    with Session(engine) as s:
        statement = select(Tx).where(Tx.user_id == current_user.id)
        txs = s.exec(statement).all()
        if not txs:
            raise HTTPException(status_code=404, detail="No transactions")

        df = pd.DataFrame(
            [{"tx_date": t.tx_date, "amount": t.amount} for t in txs]
        )
        df = df.groupby("tx_date")["amount"].sum().sort_index()
        running = df.cumsum()

        base = running.index.min()
        idx = (running.index - base).days
        model = LinearRegression().fit(idx.to_frame(), running.values)

        last_idx = idx.iloc[-1]
        last_date = running.index.max()
        future_dates = [last_date + timedelta(days=i) for i in range(1, days + 1)]
        future_idx = [[last_idx + i] for i in range(1, days + 1)]
        preds = model.predict(future_idx)

        return [
            {"tx_date": d.isoformat(), "predicted_balance": float(p)}
            for d, p in zip(future_dates, preds)
        ]
