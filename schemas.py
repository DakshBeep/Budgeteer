from datetime import date
from typing import Optional
from pydantic import BaseModel
try:
    from pydantic import model_validator
except ImportError:  # Pydantic v1 fallback
    model_validator = None
    from pydantic import root_validator


class TxIn(BaseModel):
    tx_date: date
    amount: float
    label: str
    notes: Optional[str] = None
    recurring: bool = False

    if model_validator:
        @model_validator(mode="after")
        def check_values(cls, model: "TxIn") -> "TxIn":
            if model.amount == 0:
                raise ValueError("amount must not be zero")
            if not model.recurring and model.tx_date > date.today():
                raise ValueError(
                    "tx_date cannot be in the future for non-recurring entries"
                )
            return model
    else:
        @root_validator(skip_on_failure=True)
        def check_values(cls, values):
            if values.get("amount") == 0:
                raise ValueError("amount must not be zero")
            if (
                not values.get("recurring")
                and values.get("tx_date") > date.today()
            ):
                raise ValueError(
                    "tx_date cannot be in the future for non-recurring entries"
                )
            return values
