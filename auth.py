from fastapi import APIRouter, Depends, HTTPException, Header, Body, Form
from sqlmodel import Session, select, create_engine
from passlib.context import CryptContext
from datetime import datetime, timedelta
import jwt
import os
import logging

from dbmodels import User

# Create engine directly to avoid circular import
DB_URL = os.getenv("DATABASE_URL", "sqlite:///budgeteer.db")
engine = create_engine(DB_URL, echo=False)

router = APIRouter()

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

if not JWT_SECRET:
    logger.warning("JWT_SECRET not set! Using insecure default.")
    JWT_SECRET = "change-me"


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


@router.post("/register")
def register(username: str = Form(...), password: str = Form(...)):
    with Session(engine) as s:
        existing = s.exec(select(User).where(User.username == username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username taken")
        user = User(username=username, password_hash=pwd_context.hash(password))
        s.add(user)
        s.commit()
        s.refresh(user)
        return {"id": user.id, "username": user.username}


@router.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    with Session(engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        if not user or not pwd_context.verify(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        payload = {"user_id": user.id, "exp": datetime.utcnow() + timedelta(hours=1)}
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return {"token": token}


@router.get("/me")
def whoami(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}


@router.post("/change_password")
def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    user: User = Depends(get_current_user),
):
    with Session(engine) as s:
        db_user = s.get(User, user.id)
        if not pwd_context.verify(current_password, db_user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect current password")
        db_user.password_hash = pwd_context.hash(new_password)
        s.add(db_user)
        s.commit()
        return {"status": "ok"}
