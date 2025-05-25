import os
import sys
import tempfile
import pytest

# Ensure local packages (including a lightweight 'multipart' stub) are on the path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import multipart  # load lightweight stub before FastAPI imports Starlette
import starlette.formparsers as fp
fp.multipart = multipart  # make FastAPI think python-multipart is installed

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
import main
import database
import auth
import transactions
import forecast
import analytics

@pytest.fixture(autouse=True)
def temp_db(monkeypatch):
    fd, path = tempfile.mkstemp()
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}")
    # Patch all modules to use test engine
    main.engine = engine
    database.engine = engine
    auth.engine = engine
    transactions.engine = engine
    forecast.engine = engine
    analytics.engine = engine
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(auth, "engine", engine)
    monkeypatch.setattr(transactions, "engine", engine)
    monkeypatch.setattr(forecast, "engine", engine)
    monkeypatch.setattr(analytics, "engine", engine)
    SQLModel.metadata.create_all(engine)
    yield
    os.remove(path)

client = TestClient(main.app)

def register_and_login(username="user", password="pass"):
    r = client.post("/register", data={"username": username, "password": password})
    assert r.status_code == 200
    r = client.post("/login", data={"username": username, "password": password})
    assert r.status_code == 200
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_register_login():
    headers = register_and_login()
    r = client.get("/me", headers=headers)
    assert r.status_code == 200

def test_add_tx_and_list():
    headers = register_and_login("a", "b")
    payload = {"tx_date": str(main.date.today()), "amount": 10.0, "label": "Food"}
    r = client.post("/tx", json=payload, headers=headers)
    assert r.status_code == 200
    r = client.get("/tx", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

def test_add_tx_zero_amount():
    headers = register_and_login("c", "d")
    payload = {"tx_date": str(main.date.today()), "amount": 0, "label": "Food"}
    r = client.post("/tx", json=payload, headers=headers)
    assert r.status_code == 422


def test_add_tx_future_date():
    headers = register_and_login("x", "y")
    tomorrow = main.date.today() + main.timedelta(days=1)
    payload = {"tx_date": str(tomorrow), "amount": 5.0, "label": "Food"}
    r = client.post("/tx", json=payload, headers=headers)
    assert r.status_code == 422

def test_forecast():
    headers = register_and_login("e", "f")
    payload = {"tx_date": str(main.date.today()), "amount": 5.0, "label": "Food"}
    client.post("/tx", json=payload, headers=headers)
    r = client.get("/forecast", params={"days": 3}, headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 3


def test_budget_goal():
    headers = register_and_login("g", "h")
    r = client.post("/goal", params={"amount": 100}, headers=headers)
    assert r.status_code == 200
    r = client.get("/goal", headers=headers)
    assert r.status_code == 200
    assert r.json()["amount"] == 100


def test_budget_goal_new_month(monkeypatch):
    headers = register_and_login("i", "j")
    # set goal for current month
    r = client.post("/goal", params={"amount": 100}, headers=headers)
    assert r.status_code == 200

    current_month = main.date.today().replace(day=1)
    next_month = (current_month + main.timedelta(days=32)).replace(day=1)

    class FixedDate(main.date.__class__):
        @classmethod
        def today(cls):
            return next_month

    monkeypatch.setattr(main, "date", FixedDate)
    monkeypatch.setattr(transactions, "date", FixedDate)
    monkeypatch.setattr(forecast, "date", FixedDate)

    r = client.get("/goal", headers=headers)
    assert r.status_code == 200
    assert r.json()["amount"] == 0.0

    r = client.post("/goal", params={"amount": 200}, headers=headers)
    assert r.status_code == 200
    assert r.json()["amount"] == 200

    with Session(main.engine) as s:
        user = s.exec(select(main.User).where(main.User.username == "i")).first()
        goals = s.exec(select(main.BudgetGoal).where(main.BudgetGoal.user_id == user.id)).all()
        assert len(goals) == 2


def test_toggle_recurring():
    headers = register_and_login("t1", "pw")
    payload = {"tx_date": str(main.date.today()), "amount": 10.0, "label": "Food"}
    r = client.post("/tx", json=payload, headers=headers)
    tx_id = r.json()["id"]

    # toggle to recurring
    r = client.put(f"/tx/{tx_id}", json={**payload, "recurring": True}, headers=headers)
    assert r.status_code == 200
    r = client.get("/tx", headers=headers)
    assert len(r.json()) == 4  # original + 3 future

    # toggle back to non-recurring
    r = client.put(f"/tx/{tx_id}", json=payload, headers=headers)
    assert r.status_code == 200
    r = client.get("/tx", headers=headers)
    assert len(r.json()) == 1


def test_delete_recurring_series():
    headers = register_and_login("del", "pw")
    payload = {"tx_date": str(main.date.today()), "amount": -5.0, "label": "Food", "recurring": True}
    r = client.post("/tx", json=payload, headers=headers)
    tx_id = r.json()["id"]
    r = client.get("/tx", headers=headers)
    assert len(r.json()) == 4
    # delete first transaction -> removes future ones
    r = client.delete(f"/tx/{tx_id}", headers=headers)
    assert r.status_code == 204
    r = client.get("/tx", headers=headers)
    assert len(r.json()) == 0


def test_change_password():
    headers = register_and_login("chuser", "oldpw")
    r = client.post(
        "/change_password",
        json={"current_password": "oldpw", "new_password": "newpw"},
        headers=headers,
    )
    assert r.status_code == 200
    r = client.post("/login", data={"username": "chuser", "password": "newpw"})
    assert r.status_code == 200


def test_recurring_extension(monkeypatch):
    headers = register_and_login("ext", "pw")
    today = main.date.today()
    payload = {"tx_date": str(today), "amount": 5.0, "label": "Food", "recurring": True}
    client.post("/tx", json=payload, headers=headers)
    r = client.get("/tx", headers=headers)
    assert len(r.json()) == 4

    future_day = today + main.timedelta(days=65)

    class FixedDate(main.date.__class__):
        @classmethod
        def today(cls):
            return future_day

    monkeypatch.setattr(main, "date", FixedDate)
    monkeypatch.setattr(transactions, "date", FixedDate)
    monkeypatch.setattr(forecast, "date", FixedDate)

    r = client.get("/tx", headers=headers)
    assert len(r.json()) == 6
