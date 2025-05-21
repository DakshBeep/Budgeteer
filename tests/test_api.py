import os
import sys
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import main

@pytest.fixture(autouse=True)
def temp_db(monkeypatch):
    fd, path = tempfile.mkstemp()
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}")
    main.engine = engine
    SQLModel.metadata.create_all(engine)
    yield
    os.remove(path)

client = TestClient(main.app)

def register_and_login(username="user", password="pass"):
    r = client.post("/register", params={"username": username, "password": password})
    assert r.status_code == 200
    r = client.post("/login", params={"username": username, "password": password})
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
