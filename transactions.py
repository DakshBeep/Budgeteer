from datetime import datetime, timedelta
import main
import pandas as pd
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
import logging

import main
from dbmodels import Tx
from schemas import TxIn
from auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _extend_recurring(user, s: Session, months: int = 3) -> None:
    today = main.date.today()
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
                notes=last_tx.notes,
                recurring=True,
                user_id=user.id,
                series_id=sid,
            )
            s.add(future_tx)
            last_tx = future_tx
            future_count += 1
    if series_ids:
        s.commit()


@router.post("/tx", response_model=Tx)
def add_tx(tx_in: TxIn, user=Depends(get_current_user)) -> Tx:
    series_id = int(datetime.utcnow().timestamp()) if tx_in.recurring else None
    tx = Tx(**tx_in.dict(), user_id=user.id, series_id=series_id)
    with Session(main.engine) as s:
        s.add(tx)
        if tx_in.recurring:
            for i in range(1, 4):
                future_date = (pd.Timestamp(tx_in.tx_date) + pd.DateOffset(months=i)).date()
                future_tx = Tx(
                    tx_date=future_date,
                    amount=tx_in.amount,
                    label=tx_in.label,
                    notes=tx_in.notes,
                    recurring=True,
                    user_id=user.id,
                    series_id=series_id,
                )
                s.add(future_tx)
        s.commit()
        s.refresh(tx)
        return tx


@router.get("/tx", response_model=List[Tx])
def list_tx(user=Depends(get_current_user)) -> List[Tx]:
    with Session(main.engine) as s:
        _extend_recurring(user, s)
        stmt = select(Tx).where(Tx.user_id == user.id).order_by(Tx.tx_date.desc())
        return s.exec(stmt).all()


@router.put("/tx/{tx_id}", response_model=Tx)
def update_tx(tx_id: int, tx_in: TxIn, propagate: bool = False, user=Depends(get_current_user)) -> Tx:
    with Session(main.engine) as s:
        tx = s.get(Tx, tx_id)
        if not tx or tx.user_id != user.id:
            raise HTTPException(status_code=404, detail="Not found")
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
                future_date = (pd.Timestamp(tx_in.tx_date) + pd.DateOffset(months=i)).date()
                future_tx = Tx(
                    tx_date=future_date,
                    amount=tx_in.amount,
                    label=tx_in.label,
                    notes=tx_in.notes,
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
        tx.notes = tx_in.notes
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
                f.notes = tx_in.notes
                f.tx_date = f.tx_date + delta
                s.add(f)
        s.add(tx)
        s.commit()
        s.refresh(tx)
        return tx


@router.delete("/tx/{tx_id}", status_code=204)
def delete_tx(tx_id: int, user=Depends(get_current_user)) -> None:
    with Session(main.engine) as s:
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


@router.get("/reminders", response_model=List[Tx])
def get_reminders(days: int = 30, user=Depends(get_current_user)) -> List[Tx]:
    cutoff = main.date.today() + timedelta(days=days)
    with Session(main.engine) as s:
        _extend_recurring(user, s)
        stmt = select(Tx).where(
            Tx.user_id == user.id,
            Tx.recurring == True,
            Tx.tx_date > main.date.today(),
            Tx.tx_date <= cutoff,
        )
        return s.exec(stmt).all()
