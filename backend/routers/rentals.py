"""
Rental Routes - API endpoints for rental management
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
    prefix="/rentals",
    tags=["Rentals"],
    responses={404: {"description": "Rental not found"}}
)


@router.get("/", response_model=List[schemas.RentalWithDetails])
def list_rentals(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=100, description="Maximum number of records to return"),
    active_only: bool = Query(False, description="Filter only active rentals"),
    db: Session = Depends(get_db)
):
    """
    Get list of all rentals with car and renter details
    
    - **skip**: Pagination offset (default: 0)
    - **limit**: Maximum items to return (default: 100)
    - **active_only**: If true, only return active rentals (default: false)
    """
    if active_only:
        rentals = crud.get_active_rentals(db, skip=skip, limit=limit)
    else:
        rentals = crud.get_rentals(db, skip=skip, limit=limit)
    return rentals


@router.get("/{rental_id}", response_model=schemas.RentalWithDetails)
def get_rental(rental_id: int, db: Session = Depends(get_db)):
    """
    Get a specific rental by ID with car and renter details
    
    - **rental_id**: The ID of the rental
    """
    rental = crud.get_rental_with_details(db, rental_id=rental_id)
    if rental is None:
        raise HTTPException(status_code=404, detail="Rental not found")
    return rental


@router.get("/car/{car_id}", response_model=List[schemas.RentalWithDetails])
def get_rentals_by_car(car_id: int, db: Session = Depends(get_db)):
    """
    Get all rentals for a specific car
    
    - **car_id**: The ID of the car
    """
    # Check if car exists
    car = crud.get_car(db, car_id=car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    rentals = crud.get_rentals_by_car(db, car_id=car_id)
    return rentals


@router.get("/renter/{renter_id}", response_model=List[schemas.RentalWithDetails])
def get_rentals_by_renter(renter_id: int, db: Session = Depends(get_db)):
    """
    Get all rentals for a specific renter
    
    - **renter_id**: The ID of the renter
    """
    # Check if renter exists
    renter = crud.get_renter(db, renter_id=renter_id)
    if not renter:
        raise HTTPException(status_code=404, detail="Renter not found")
    
    rentals = crud.get_rentals_by_renter(db, renter_id=renter_id)
    return rentals


@router.post("/", response_model=schemas.RentalResponse, status_code=201)
def create_rental(rental: schemas.RentalCreate, db: Session = Depends(get_db)):
    """
    Create a new rental
    
    - **carId**: ID of the car to rent (must be available)
    - **renterId**: ID of the renter
    - **dateDebut**: Start date (defaults to now)
    - **kmDebut**: Starting mileage
    
    This will automatically set the car status to 'rented' (etat = 1)
    """
    try:
        return crud.create_rental(db=db, rental=rental)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{rental_id}", response_model=schemas.RentalResponse)
def update_rental(
    rental_id: int, 
    rental_update: schemas.RentalUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a rental (typically used for returning a car)
    
    - **rental_id**: The ID of the rental to update
    - **dateFin**: End date (when car is returned)
    - **kmFin**: Final mileage (when car is returned)
    - **montantTotal**: Total amount charged
    
    When dateFin and kmFin are provided, the car will be set back to 'available' (etat = 0)
    """
    updated_rental = crud.update_rental(db=db, rental_id=rental_id, rental_update=rental_update)
    if updated_rental is None:
        raise HTTPException(status_code=404, detail="Rental not found")
    return updated_rental


@router.delete("/{rental_id}", response_model=schemas.MessageResponse)
def delete_rental(rental_id: int, db: Session = Depends(get_db)):
    """
    Delete a rental
    
    - **rental_id**: The ID of the rental to delete
    
    If the rental is active, the car will be set back to 'available'
    """
    success = crud.delete_rental(db=db, rental_id=rental_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rental not found")
    return {"message": f"Rental {rental_id} deleted successfully"}


