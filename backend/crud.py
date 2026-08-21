
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime

try:
    from . import models, schemas
except ImportError:
    import models, schemas


def _as_datetime(value):
    if value is None or isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def apply_rental_status(rental):
    """Derive a return status only from a confirmed return and the planned deadline."""
    planned = _as_datetime(getattr(rental, "dateFinPrevue", None)) or _as_datetime(
        getattr(rental, "dateFin", None)
    )
    actual = _as_datetime(getattr(rental, "dateRetourReelle", None))
    returned = actual is not None or getattr(rental, "kmFin", None) is not None

    if returned:
        if actual and planned and actual > planned:
            rental.statut = "Retournée en retard"
        else:
            rental.statut = "Retournée à temps"
    elif planned and datetime.utcnow().date() > planned.date():
        rental.statut = "En retard"
    else:
        rental.statut = "Active"
    return rental


def convert_timestamps_to_iso(obj):
    """Normalize legacy millisecond timestamps while preserving DateTime values."""
    if hasattr(obj, '__dict__'):
        if hasattr(obj, "carId") and hasattr(obj, "renterId"):
            apply_rental_status(obj)
        for key in ['createdAt', 'updatedAt', 'dateDebut', 'dateFin', 'dateFinPrevue', 'dateRetourReelle']:
            value = getattr(obj, key, None)
            if value and isinstance(value, (int, float)):
                setattr(obj, key, datetime.fromtimestamp(value / 1000))
    return obj


# ============== Car CRUD Operations ==============

def get_car(db: Session, car_id: int) -> Optional[models.Car]:
    """Get a car by ID"""
    car = db.query(models.Car).filter(models.Car.id == car_id).first()
    return convert_timestamps_to_iso(car) if car else None


def get_car_by_registration(db: Session, numImma: str) -> Optional[models.Car]:
    """Get a car by registration number"""
    car = db.query(models.Car).filter(models.Car.numImma == numImma).first()
    return convert_timestamps_to_iso(car) if car else None


def get_cars(db: Session, skip: int = 0, limit: int = 100) -> List[models.Car]:
    """Get all cars with pagination"""
    cars = (
        db.query(models.Car)
        .filter(models.Car.is_active.is_(True))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [convert_timestamps_to_iso(car) for car in cars]


def get_available_cars(db: Session, skip: int = 0, limit: int = 100) -> List[models.Car]:
    """Get all available cars (etat = 0)"""
    cars = (
        db.query(models.Car)
        .filter(models.Car.etat == 0, models.Car.is_active.is_(True))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [convert_timestamps_to_iso(car) for car in cars]


def create_car(db: Session, car: schemas.CarCreate) -> models.Car:
    """Create a new car"""
    car_data = car.model_dump()
    now = datetime.utcnow().isoformat() + 'Z'
    car_data['createdAt'] = now
    car_data['updatedAt'] = now
    db_car = models.Car(**car_data)
    db.add(db_car)
    db.commit()
    db.refresh(db_car)
    return convert_timestamps_to_iso(db_car)


def update_car(db: Session, car_id: int, car_update: schemas.CarUpdate) -> Optional[models.Car]:
    """Update a car"""
    db_car = db.query(models.Car).filter(models.Car.id == car_id).first()
    if not db_car:
        return None
    
    # Update only provided fields
    update_data = car_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_car, key, value)
    
    db_car.updatedAt = datetime.utcnow().isoformat() + 'Z'
    db.commit()
    db.refresh(db_car)
    return convert_timestamps_to_iso(db_car)


def delete_car(db: Session, car_id: int) -> bool:
    """Delete a car"""
    db_car = get_car(db, car_id)
    if not db_car:
        return False
    
    db.delete(db_car)
    db.commit()
    return True


# ============== Renter CRUD Operations ==============

def get_renter(db: Session, renter_id: int) -> Optional[models.Renter]:
    """Get a renter by ID"""
    renter = db.query(models.Renter).filter(models.Renter.id == renter_id).first()
    return convert_timestamps_to_iso(renter) if renter else None


def get_renters(db: Session, skip: int = 0, limit: int = 100) -> List[models.Renter]:
    """Get active renters with pagination."""
    renters = (
        db.query(models.Renter)
        .filter(models.Renter.is_active.is_(True))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [convert_timestamps_to_iso(renter) for renter in renters]


def search_renters(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[models.Renter]:
    """Search renters by name or first name"""
    search_pattern = f"%{query}%"
    renters = db.query(models.Renter).filter(
        models.Renter.is_active.is_(True),
        (models.Renter.nom.like(search_pattern)) |
        (models.Renter.prenom.like(search_pattern))
    ).offset(skip).limit(limit).all()
    return [convert_timestamps_to_iso(renter) for renter in renters]


def create_renter(db: Session, renter: schemas.RenterCreate) -> models.Renter:
    """Create a new renter"""
    renter_data = renter.model_dump()
    now = datetime.utcnow().isoformat() + 'Z'
    renter_data['createdAt'] = now
    renter_data['updatedAt'] = now
    db_renter = models.Renter(**renter_data)
    db.add(db_renter)
    db.commit()
    db.refresh(db_renter)
    return convert_timestamps_to_iso(db_renter)


def update_renter(db: Session, renter_id: int, renter_update: schemas.RenterUpdate) -> Optional[models.Renter]:
    """Update a renter"""
    db_renter = db.query(models.Renter).filter(models.Renter.id == renter_id).first()
    if not db_renter:
        return None
    
    update_data = renter_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_renter, key, value)
    
    db_renter.updatedAt = datetime.utcnow().isoformat() + 'Z'
    db.commit()
    db.refresh(db_renter)
    return convert_timestamps_to_iso(db_renter)



def get_rental(db: Session, rental_id: int) -> Optional[models.Rental]:
    """Get a rental by ID"""
    rental = db.query(models.Rental).filter(models.Rental.id == rental_id).first()
    return convert_timestamps_to_iso(rental) if rental else None


def get_rental_with_details(db: Session, rental_id: int) -> Optional[models.Rental]:
    """Get a rental by ID with car and renter details"""
    rental = db.query(models.Rental).options(
        joinedload(models.Rental.car),
        joinedload(models.Rental.renter)
    ).filter(models.Rental.id == rental_id).first()
    if rental:
        convert_timestamps_to_iso(rental)
        if rental.car:
            convert_timestamps_to_iso(rental.car)
        if rental.renter:
            convert_timestamps_to_iso(rental.renter)
    return rental


def get_rentals(db: Session, skip: int = 0, limit: int = 100) -> List[models.Rental]:
    """Get all rentals with pagination"""
    rentals = db.query(models.Rental).options(
        joinedload(models.Rental.car),
        joinedload(models.Rental.renter)
    ).offset(skip).limit(limit).all()
    for rental in rentals:
        convert_timestamps_to_iso(rental)
        if rental.car:
            convert_timestamps_to_iso(rental.car)
        if rental.renter:
            convert_timestamps_to_iso(rental.renter)
    return rentals


def get_active_rentals(db: Session, skip: int = 0, limit: int = 100) -> List[models.Rental]:
    """Get all rentals whose return has not been confirmed."""
    rentals = db.query(models.Rental).options(
        joinedload(models.Rental.car),
        joinedload(models.Rental.renter)
    ).filter(
        models.Rental.dateRetourReelle == None,
        models.Rental.kmFin == None,
    ).offset(skip).limit(limit).all()
    for rental in rentals:
        convert_timestamps_to_iso(rental)
        if rental.car:
            convert_timestamps_to_iso(rental.car)
        if rental.renter:
            convert_timestamps_to_iso(rental.renter)
    return rentals


def get_rentals_by_car(db: Session, car_id: int) -> List[models.Rental]:
    """Get all rentals for a specific car"""
    rentals = db.query(models.Rental).options(
        joinedload(models.Rental.car),
        joinedload(models.Rental.renter)
    ).filter(models.Rental.carId == car_id).all()
    for rental in rentals:
        convert_timestamps_to_iso(rental)
        if rental.car:
            convert_timestamps_to_iso(rental.car)
        if rental.renter:
            convert_timestamps_to_iso(rental.renter)
    return rentals


def get_rentals_by_renter(db: Session, renter_id: int) -> List[models.Rental]:
    """Get all rentals for a specific renter"""
    rentals = db.query(models.Rental).options(
        joinedload(models.Rental.car),
        joinedload(models.Rental.renter)
    ).filter(models.Rental.renterId == renter_id).all()
    for rental in rentals:
        convert_timestamps_to_iso(rental)
        if rental.car:
            convert_timestamps_to_iso(rental.car)
        if rental.renter:
            convert_timestamps_to_iso(rental.renter)
    return rentals


def create_rental(db: Session, rental: schemas.RentalCreate) -> models.Rental:
    """Create a new rental and update car state to rented"""
    # Check if car exists and is available
    car = get_car(db, rental.carId)
    if not car or not car.is_active:
        raise ValueError("Car not found")
    if car.etat != 0:
        raise ValueError("Car is not available")
    
    # Check if renter exists
    renter = get_renter(db, rental.renterId)
    if not renter or not renter.is_active:
        raise ValueError("Renter not found or archived")
  
    rental_data = rental.model_dump(exclude_unset=True)
    planned_return = rental_data.get("dateFinPrevue") or rental_data.get("dateFin")
    if planned_return:
        planned_return = _as_datetime(planned_return)
        rental_data["dateFinPrevue"] = planned_return
        rental_data["dateFin"] = planned_return
    rental_data["statut"] = "Active"
    if 'dateDebut' not in rental_data or not rental_data['dateDebut']:
        rental_data['dateDebut'] = datetime.utcnow().isoformat()
    
    rental_data['createdAt'] = datetime.utcnow().isoformat()
    rental_data['updatedAt'] = datetime.utcnow().isoformat()
    
    db_rental = models.Rental(**rental_data)
    db.add(db_rental)
    
    # Update car state to rented and mileage
    car.etat = 1
    car.kilometrage = rental.kmDebut
    car.updatedAt = datetime.utcnow().isoformat()
    
    try:
        db.commit()
        db.refresh(db_rental)
    except Exception:
        db.rollback()
        raise
    return db_rental


def update_rental(db: Session, rental_id: int, rental_update: schemas.RentalUpdate) -> Optional[models.Rental]:
    """Update a rental (typically for returning a car)"""
    db_rental = get_rental(db, rental_id)
    if not db_rental:
        return None
    
    # Update only provided fields
    update_data = rental_update.model_dump(exclude_unset=True)
    if "renterId" in update_data:
        renter = db.query(models.Renter).filter(
            models.Renter.id == update_data["renterId"],
            models.Renter.is_active.is_(True),
        ).first()
        if renter is None:
            raise ValueError("Le locataire sélectionné est introuvable ou archivé.")

    if "carId" in update_data and update_data["carId"] != db_rental.carId:
        new_car = db.query(models.Car).filter(
            models.Car.id == update_data["carId"],
            models.Car.is_active.is_(True),
        ).first()
        if new_car is None or new_car.etat != 0:
            raise ValueError("La voiture sélectionnée n'est pas disponible.")
        old_car = db.query(models.Car).filter(models.Car.id == db_rental.carId).first()
        if old_car:
            old_car.etat = 0
            old_car.updatedAt = datetime.utcnow()
        new_car.etat = 1
        new_car.updatedAt = datetime.utcnow()

    if "dateDebut" in update_data:
        update_data["dateDebut"] = _as_datetime(update_data["dateDebut"])
    if "dateFinPrevue" in update_data or ("dateFin" in update_data and rental_update.kmFin is None):
        planned_return = _as_datetime(update_data.get("dateFinPrevue") or update_data.get("dateFin"))
        update_data["dateFinPrevue"] = planned_return
        update_data["dateFin"] = planned_return

    if rental_update.kmFin is not None:
        actual_return = _as_datetime(update_data.get("dateRetourReelle"))
        # Backward compatibility for older clients that sent dateFin as the actual return.
        if actual_return is None and update_data.get("dateFin") and "dateFinPrevue" not in update_data:
            actual_return = _as_datetime(update_data.get("dateFin"))
        update_data["dateRetourReelle"] = actual_return or datetime.utcnow()
        update_data.pop("dateFin", None)
        update_data.pop("statut", None)
    for key, value in update_data.items():
        setattr(db_rental, key, value)
    
    db_rental.updatedAt = datetime.utcnow().isoformat()
    
   
    if rental_update.kmFin is not None:
        car = get_car(db, db_rental.carId)
        if car:
            car.etat = 0  # Set car as available
            car.kilometrage = rental_update.kmFin
            car.updatedAt = datetime.utcnow().isoformat()

    apply_rental_status(db_rental)
    
    db.commit()
    db.refresh(db_rental)
    return db_rental


def delete_rental(db: Session, rental_id: int) -> bool:
    """Delete a rental and its payments, then release its vehicle."""
    db_rental = db.query(models.Rental).filter(models.Rental.id == rental_id).first()
    if not db_rental:
        return False

    car = db.query(models.Car).filter(models.Car.id == db_rental.carId).first()
    if car:
        car.etat = 0
        car.updatedAt = datetime.utcnow()

    try:
        db.query(models.Payment).filter(
            models.Payment.rental_id == rental_id
        ).delete(synchronize_session=False)
        db.delete(db_rental)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True
