from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

try:
    from .. import models, schemas
    from ..database import get_db
    from ..security import get_current_user
except ImportError:
    import models, schemas
    from database import get_db
    from security import get_current_user


router = APIRouter(
    prefix="/maintenance",
    tags=["Maintenance"],
    dependencies=[Depends(get_current_user)],
)


def get_maintenance_or_404(db: Session, maintenance_id: int) -> models.Maintenance:
    maintenance = (
        db.query(models.Maintenance)
        .options(joinedload(models.Maintenance.car))
        .filter(models.Maintenance.id == maintenance_id)
        .first()
    )
    if maintenance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance introuvable.")
    return maintenance


@router.get("", response_model=List[schemas.MaintenanceResponse])
def list_maintenance(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(models.Maintenance)
        .options(joinedload(models.Maintenance.car))
        .order_by(models.Maintenance.created_at.desc())
        .all()
    )


@router.get("/{maintenance_id}", response_model=schemas.MaintenanceResponse)
def get_maintenance(maintenance_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_maintenance_or_404(db, maintenance_id)


@router.post("", response_model=schemas.MaintenanceResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    item: schemas.MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    car = (
        db.query(models.Car)
        .filter(models.Car.id == item.car_id, models.Car.is_active.is_(True))
        .first()
    )
    if car is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La voiture sélectionnée est introuvable ou archivée.",
        )

    data = item.model_dump(exclude_unset=True)
    if data.get("date_maintenance") is None:
        data["date_maintenance"] = datetime.utcnow()

    maintenance = models.Maintenance(**data)
    try:
        db.add(maintenance)
        db.commit()
        db.refresh(maintenance)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La maintenance entre en conflit avec les données existantes.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="L’enregistrement de la maintenance a échoué. Aucune donnée n’a été modifiée.",
        ) from exc
    return (
        db.query(models.Maintenance)
        .options(joinedload(models.Maintenance.car))
        .filter(models.Maintenance.id == maintenance.id)
        .first()
    )


@router.put("/{maintenance_id}", response_model=schemas.MaintenanceResponse)
def update_maintenance(
    maintenance_id: int,
    item: schemas.MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    maintenance = get_maintenance_or_404(db, maintenance_id)
    update_data = item.model_dump(exclude_unset=True)

    if "car_id" in update_data and update_data["car_id"] is not None:
        car = (
            db.query(models.Car)
            .filter(
                models.Car.id == update_data["car_id"],
                models.Car.is_active.is_(True),
            )
            .first()
        )
        if car is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La voiture sélectionnée est introuvable ou archivée.",
            )

    for key, value in update_data.items():
        setattr(maintenance, key, value)

    try:
        db.commit()
        db.refresh(maintenance)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La modification entre en conflit avec les données existantes.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La modification de la maintenance a échoué. Aucune donnée n’a été modifiée.",
        ) from exc
    return (
        db.query(models.Maintenance)
        .options(joinedload(models.Maintenance.car))
        .filter(models.Maintenance.id == maintenance.id)
        .first()
    )


@router.delete("/{maintenance_id}")
def delete_maintenance(maintenance_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    maintenance = get_maintenance_or_404(db, maintenance_id)
    try:
        db.delete(maintenance)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette maintenance possède des données associées et ne peut pas être supprimée.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La suppression de la maintenance a échoué. Aucune donnée n’a été modifiée.",
        ) from exc
    return {"message": "Maintenance supprimée avec succès."}
