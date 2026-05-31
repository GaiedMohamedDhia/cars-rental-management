"""
CRUD Operations for Database Models
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime

try:
    from . import models, schemas
except ImportError:
    import models, schemas


def convert_timestamps_to_iso(obj):
    """Convert millisecond timestamps to ISO strings"""
    if hasattr(obj, '__dict__'):
        for key in ['createdAt', 'updatedAt', 'dateDebut', 'dateFin']:
            value = getattr(obj, key, None)
            if value and isinstance(value, (int, float)):
                # Convert milliseconds to seconds and format as ISO string
                setattr(obj, key, datetime.fromtimestamp(value / 1000).isoformat() + 'Z')
            elif value and not isinstance(value, str):
                # If it's already a datetime object, convert to string
                setattr(obj, key, value.isoformat() + 'Z' if hasattr(value, 'isoformat') else str(value))
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
    cars = db.query(models.Car).offset(skip).limit(limit).all()
    return [convert_timestamps_to_iso(car) for car in cars]


def get_available_cars(db: Session, skip: int = 0, limit: int = 100) -> List[models.Car]:
    """Get all available cars (etat = 0)"""
    cars = db.query(models.Car).filter(models.Car.etat == 0).offset(skip).limit(limit).all()
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
    """Get all renters with pagination"""
    renters = db.query(models.Renter).offset(skip).limit(limit).all()
    return [convert_timestamps_to_iso(renter) for renter in renters]


def search_renters(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[models.Renter]:
    """Search renters by name or first name"""
    search_pattern = f"%{query}%"
    renters = db.query(models.Renter).filter(
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
    
    # Update only provided fields
    update_data = renter_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_renter, key, value)
    
    db_renter.updatedAt = datetime.utcnow().isoformat() + 'Z'
    db.commit()
    db.refresh(db_renter)
    return convert_timestamps_to_iso(db_renter)


def delete_renter(db: Session, renter_id: int) -> bool:
    """Delete a renter"""
    db_renter = get_renter(db, renter_id)
    if not db_renter:
        return False
    
    db.delete(db_renter)
    db.commit()
    return True


# ============== Rental CRUD Operations ==============

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
    """Get all active rentals (dateFin is null)"""
    rentals = db.query(models.Rental).options(
        joinedload(models.Rental.car),
        joinedload(models.Rental.renter)
    ).filter(models.Rental.dateFin == None).offset(skip).limit(limit).all()
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
    if not car:
        raise ValueError("Car not found")
    if car.etat == 1:
        raise ValueError("Car is already rented")
    
    # Check if renter exists
    renter = get_renter(db, rental.renterId)
    if not renter:
        raise ValueError("Renter not found")
    
    # Create rental - prepare data
    rental_data = rental.model_dump(exclude_unset=True)
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
    
    db.commit()
    db.refresh(db_rental)
    return db_rental


def update_rental(db: Session, rental_id: int, rental_update: schemas.RentalUpdate) -> Optional[models.Rental]:
    """Update a rental (typically for returning a car)"""
    db_rental = get_rental(db, rental_id)
    if not db_rental:
        return None
    
    # Update only provided fields
    update_data = rental_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rental, key, value)
    
    db_rental.updatedAt = datetime.utcnow().isoformat()
    
    # If car is returned (dateFin and kmFin are set), update car state and mileage
    if rental_update.dateFin and rental_update.kmFin is not None:
        car = get_car(db, db_rental.carId)
        if car:
            car.etat = 0  # Set car as available
            car.kilometrage = rental_update.kmFin
            car.updatedAt = datetime.utcnow().isoformat()
    
    db.commit()
    db.refresh(db_rental)
    return db_rental


def delete_rental(db: Session, rental_id: int) -> bool:
    """Delete a rental"""
    db_rental = get_rental(db, rental_id)
    if not db_rental:
        return False
    
    # If rental was active, set car back to available
    if not db_rental.dateFin:
        car = get_car(db, db_rental.carId)
        if car:
            car.etat = 0
            car.updatedAt = datetime.utcnow().isoformat()
    
    db.delete(db_rental)
    db.commit()
    return True


