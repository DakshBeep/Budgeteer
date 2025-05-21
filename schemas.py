from datetime import date
from typing import Optional
from pydantic import BaseModel, root_validator

class TxIn(BaseModel):
    tx_date: date
    amount: float
    label: str
    notes: Optional[str] = None
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
