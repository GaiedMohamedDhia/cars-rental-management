from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

try:
    from .. import models, schemas
    from ..database import get_db
    from ..security import create_access_token, get_current_user, get_password_hash, verify_password
except ImportError:
    import models, schemas
    from database import get_db
    from security import create_access_token, get_current_user, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    nom = (user.nom or "").strip()
    prenom = (user.prenom or "").strip()
    if not nom or not prenom:
        raise HTTPException(status_code=400, detail="Le nom et le prénom sont obligatoires")

    if db.query(models.User).filter(func.lower(models.User.email) == user.email.lower()).first():
        raise HTTPException(status_code=400, detail="Cet email existe déjà")

    username_base = (user.username or user.email.split("@")[0]).strip().lower()
    username_base = re.sub(r"[^a-z0-9._-]", "", username_base) or "utilisateur"
    username, suffix = username_base, 1
    while db.query(models.User).filter(func.lower(models.User.username) == username.lower()).first():
        username = f"{username_base}{suffix}"
        suffix += 1

    db_user = models.User(
        username=username,
        email=user.email,
        hashed_password=get_password_hash(user.password),
        nom=nom,
        prenom=prenom,
        telephone=(user.telephone or "").strip() or None,
        age=user.age,
        sexe=(user.sexe or "").strip() or None,
        poste=(user.poste or "").strip() or None,
        photoUrl=user.photoUrl,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    token = create_access_token({"sub": db_user.username, "role": db_user.role})
    return {"access_token": token, "token_type": "bearer", "user": db_user}


@router.post("/login", response_model=schemas.TokenResponse)
def login(user_login: schemas.UserLogin, db: Session = Depends(get_db)):
    identifier = user_login.identifier.strip().lower()
    user = db.query(models.User).filter(or_(
        func.lower(models.User.username) == identifier,
        func.lower(models.User.email) == identifier,
    )).first()
    if user is None or not verify_password(user_login.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user=Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserResponse)
@router.put("/me", response_model=schemas.UserResponse, include_in_schema=False)
def update_current_user(payload: schemas.UserUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    values = payload.model_dump(exclude_unset=True)
    for field in ("nom", "prenom"):
        if field in values:
            values[field] = (values[field] or "").strip()
            if not values[field]:
                raise HTTPException(status_code=400, detail=f"Le champ {field} est obligatoire")
    for field in ("telephone", "sexe", "poste"):
        if field in values and isinstance(values[field], str):
            values[field] = values[field].strip() or None
    if "email" in values:
        duplicate = db.query(models.User).filter(models.User.email == values["email"], models.User.id != current_user.id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Cet email existe déjà")
    for key, value in values.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=schemas.MessageResponse)
@router.put("/me/password", response_model=schemas.MessageResponse, include_in_schema=False)
@router.put("/password", response_model=schemas.MessageResponse, include_in_schema=False)
def change_password(payload: schemas.PasswordUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Mot de passe modifié"}
