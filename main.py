# uvicorn main:app --reload

from datetime import date, timedelta
from typing import Optional, List
import pandas as pd
from sklearn.linear_model import LinearRegression
from fastapi import FastAPI
from sqlmodel import SQLModel, Field, Session, create_engine, select
from fastapi import HTTPException

app = FastAPI()
engine = create_engine("sqlite:///budgeteer.db", echo=False)

# ------------ Models -------------------------------------------------
class TxIn(SQLModel):                 # <- used only for incoming JSON
    tx_date: date
    amount: float
    label: str

class Tx(SQLModel, table=True):       # <- ORM table + outward schema
    id: Optional[int] = Field(default=None, primary_key=True)
    tx_date: date
    amount: float
    label: str
# ---------------------------------------------------------------------

@app.on_event("startup")
def init_db() -> None:
    SQLModel.metadata.create_all(engine)

# ---------- Endpoints ------------------------------------------------
@app.post("/tx", response_model=Tx)
def add_tx(tx_in: TxIn) -> Tx:
    tx = Tx(**tx_in.model_dump())           # cast JSON -> ORM object
    with Session(engine) as s:
        s.add(tx)
        s.commit()
        s.refresh(tx)
        return tx                           # <-- SINGLE object

@app.get("/tx", response_model=List[Tx])
def list_tx() -> List[Tx]:
    with Session(engine) as s:
        return s.exec(select(Tx)).all()     # <-- LIST of objects
# ---------------------------------------------------------------------
@app.delete("/tx/{tx_id}", status_code=204)
def delete_tx(tx_id: int) -> None:
    with Session(engine) as s:
        tx = s.get(Tx, tx_id)
        if not tx:
            raise HTTPException(status_code=404, detail="Not found")
        s.delete(tx)
        s.commit()


@app.get("/forecast")
def get_forecast(days: int = 7):
    """Return predicted running balance for the next ``days`` days."""
    with Session(engine) as s:
        txs = s.exec(select(Tx)).all()
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
