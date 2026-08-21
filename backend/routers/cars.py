from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from .. import crud, models, schemas
    from ..database import get_db
    from ..security import get_current_user
except ImportError:
    import crud, models, schemas
    from database import get_db
    from security import get_current_user


router = APIRouter(
    prefix="/cars",
    tags=["Cars"],
    responses={404: {"description": "Voiture introuvable"}},
    dependencies=[Depends(get_current_user)],
)


def require_car_delete_permission(current_user=Depends(get_current_user)):
    if (current_user.role or "").strip().lower() not in {"admin", "user"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n’avez pas la permission de supprimer cette voiture.",
        )
    return current_user


@router.get("/", response_model=List[schemas.CarResponse])
def list_cars(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    available_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    if available_only:
        return crud.get_available_cars(db, skip=skip, limit=limit)
    return crud.get_cars(db, skip=skip, limit=limit)


@router.get("/{car_id}", response_model=schemas.CarResponse)
def get_car(car_id: int, db: Session = Depends(get_db)):
    car = crud.get_car(db, car_id=car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Voiture introuvable.")
    return car


@router.post("/", response_model=schemas.CarResponse, status_code=status.HTTP_201_CREATED)
def create_car(car: schemas.CarCreate, db: Session = Depends(get_db)):
    existing_car = crud.get_car_by_registration(db, numImma=car.numImma)
    if existing_car:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une voiture possède déjà cette immatriculation.",
        )
    try:
        return crud.create_car(db=db, car=car)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une voiture possède déjà cette immatriculation.",
        ) from exc


@router.put("/{car_id}", response_model=schemas.CarResponse)
@router.patch("/{car_id}", response_model=schemas.CarResponse, include_in_schema=False)
def update_car(
    car_id: int,
    car_update: schemas.CarUpdate,
    db: Session = Depends(get_db),
):
    if car_update.numImma:
        existing_car = crud.get_car_by_registration(db, numImma=car_update.numImma)
        if existing_car and existing_car.id != car_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une voiture possède déjà cette immatriculation.",
            )
    try:
        updated_car = crud.update_car(db=db, car_id=car_id, car_update=car_update)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Les nouvelles données de la voiture sont en conflit.",
        ) from exc
    if updated_car is None:
        raise HTTPException(status_code=404, detail="Voiture introuvable.")
    return updated_car


@router.delete("/{car_id}", response_model=schemas.MessageResponse)
def delete_car(
    car_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_car_delete_permission),
):
    car = crud.get_car(db, car_id=car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Voiture introuvable.")

    has_rentals = (
        db.query(models.Rental.id).filter(models.Rental.carId == car_id).first()
        is not None
    )
    has_maintenance = (
        db.query(models.Maintenance.id)
        .filter(models.Maintenance.car_id == car_id)
        .first()
        is not None
    )

    try:
        if has_rentals or has_maintenance:
            car.is_active = False
            car.etat = 3
            db.commit()
            return {
                "message": (
                    "Voiture archivée. Son historique de locations, maintenances "
                    "et paiements a été conservé."
                )
            }

        if not crud.delete_car(db=db, car_id=car_id):
            raise HTTPException(status_code=404, detail="Voiture introuvable.")
        return {"message": "Voiture supprimée avec succès."}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Impossible de supprimer cette voiture car elle possède des "
                "relations associées."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La suppression de la voiture a échoué de manière inattendue.",
        ) from exc
