from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
from typing import Callable
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from dotenv import load_dotenv

try:
    from . import models
    from .database import get_db
except ImportError:
    import models
    from database import get_db


load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], default="pbkdf2_sha256", deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
UNSAFE_SECRET_KEYS = {
    "secret",
    "change-this-secret-key",
    "changeme",
    "development-secret",
}


def get_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY", "").strip()
    if not secret_key:
        raise RuntimeError(
            "SECRET_KEY is required. Configure a cryptographically random value "
            "of at least 32 characters before starting the API."
        )
    if len(secret_key) < 32 or secret_key.lower() in UNSAFE_SECRET_KEYS:
        raise RuntimeError(
            "SECRET_KEY is insecure. Configure a cryptographically random value "
            "of at least 32 characters."
        )
    return secret_key


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    issued_at = datetime.now(timezone.utc)
    expire = issued_at + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": issued_at, "jti": uuid4().hex})
    return jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    return user


def require_roles(*allowed_roles: str) -> Callable:
    normalized_roles = {role.strip().lower() for role in allowed_roles if role.strip()}

    def role_dependency(current_user=Depends(get_current_user)):
        current_role = (current_user.role or "").strip().lower()
        if current_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency
