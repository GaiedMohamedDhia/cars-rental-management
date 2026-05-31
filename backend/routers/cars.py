"""
Car Routes - API endpoints for car management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

try:
    from .. import crud, schemas
    from ..database import get_db
except ImportError:
    import crud, schemas
    from database import get_db

router = APIRouter(
    prefix="/cars",
    tags=["Cars"],
    responses={404: {"description": "Car not found"}}
)


@router.get("/", response_model=List[schemas.CarResponse])
def list_cars(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=100, description="Maximum number of records to return"),
    available_only: bool = Query(False, description="Filter only available cars"),
    db: Session = Depends(get_db)
):
    """
    Get list of all cars
    
    - **skip**: Pagination offset (default: 0)
    - **limit**: Maximum items to return (default: 100)
    - **available_only**: If true, only return available cars (default: false)
    """
    if available_only:
        cars = crud.get_available_cars(db, skip=skip, limit=limit)
    else:
        cars = crud.get_cars(db, skip=skip, limit=limit)
    return cars


@router.get("/{car_id}", response_model=schemas.CarResponse)
def get_car(car_id: int, db: Session = Depends(get_db)):
    """
    Get a specific car by ID
    
    - **car_id**: The ID of the car
    """
    car = crud.get_car(db, car_id=car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@router.post("/", response_model=schemas.CarResponse, status_code=201)
def create_car(car: schemas.CarCreate, db: Session = Depends(get_db)):
    """
    Create a new car
    
    - **numImma**: Registration number (must be unique)
    - **marque**: Car brand
    - **modele**: Car model
    - **kilometrage**: Current mileage (must be >= 0)
    - **etat**: Car state (0: available, 1: rented) - defaults to 0
    - **prixLocation**: Rental price per day (must be > 0)
    """
    # Check if car with same registration already exists
    existing_car = crud.get_car_by_registration(db, numImma=car.numImma)
    if existing_car:
        raise HTTPException(
            status_code=400, 
            detail=f"Car with registration number '{car.numImma}' already exists"
        )
    
    return crud.create_car(db=db, car=car)


@router.put("/{car_id}", response_model=schemas.CarResponse)
def update_car(
    car_id: int, 
    car_update: schemas.CarUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a car's information
    
    - **car_id**: The ID of the car to update
    - All fields are optional - only provided fields will be updated
    """
    # If updating registration number, check if it's already taken
    if car_update.numImma:
        existing_car = crud.get_car_by_registration(db, numImma=car_update.numImma)
        if existing_car and existing_car.id != car_id:
            raise HTTPException(
                status_code=400,
                detail=f"Car with registration number '{car_update.numImma}' already exists"
            )
    
    updated_car = crud.update_car(db=db, car_id=car_id, car_update=car_update)
    if updated_car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return updated_car


@router.delete("/{car_id}", response_model=schemas.MessageResponse)
def delete_car(car_id: int, db: Session = Depends(get_db)):
    """
    Delete a car
    
    - **car_id**: The ID of the car to delete
    """
    success = crud.delete_car(db=db, car_id=car_id)
    if not success:
        raise HTTPException(status_code=404, detail="Car not found")
    return {"message": f"Car {car_id} deleted successfully"}


