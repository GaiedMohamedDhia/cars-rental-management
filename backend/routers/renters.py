"""
Renter Routes - API endpoints for renter management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

try:
    from .. import crud, schemas
    from ..database import get_db
except ImportError:
    import crud, schemas
    from database import get_db

router = APIRouter(
    prefix="/renters",
    tags=["Renters"],
    responses={404: {"description": "Renter not found"}}
)


@router.get("/", response_model=List[schemas.RenterResponse])
def list_renters(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=100, description="Maximum number of records to return"),
    search: Optional[str] = Query(None, description="Search by name or first name"),
    db: Session = Depends(get_db)
):
    """
    Get list of all renters
    
    - **skip**: Pagination offset (default: 0)
    - **limit**: Maximum items to return (default: 100)
    - **search**: Optional search query for name or first name
    """
    if search:
        renters = crud.search_renters(db, query=search, skip=skip, limit=limit)
    else:
        renters = crud.get_renters(db, skip=skip, limit=limit)
    return renters


@router.get("/{renter_id}", response_model=schemas.RenterResponse)
def get_renter(renter_id: int, db: Session = Depends(get_db)):
    """
    Get a specific renter by ID
    
    - **renter_id**: The ID of the renter
    """
    renter = crud.get_renter(db, renter_id=renter_id)
    if renter is None:
        raise HTTPException(status_code=404, detail="Renter not found")
    return renter


@router.post("/", response_model=schemas.RenterResponse, status_code=201)
def create_renter(renter: schemas.RenterCreate, db: Session = Depends(get_db)):
    """
    Create a new renter
    
    - **nom**: Last name (required)
    - **prenom**: First name (required)
    - **adresse**: Address (required)
    """
    return crud.create_renter(db=db, renter=renter)


@router.put("/{renter_id}", response_model=schemas.RenterResponse)
def update_renter(
    renter_id: int, 
    renter_update: schemas.RenterUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a renter's information
    
    - **renter_id**: The ID of the renter to update
    - All fields are optional - only provided fields will be updated
    """
    updated_renter = crud.update_renter(db=db, renter_id=renter_id, renter_update=renter_update)
    if updated_renter is None:
        raise HTTPException(status_code=404, detail="Renter not found")
    return updated_renter


@router.delete("/{renter_id}", response_model=schemas.MessageResponse)
def delete_renter(renter_id: int, db: Session = Depends(get_db)):
    """
    Delete a renter
    
    - **renter_id**: The ID of the renter to delete
    """
    success = crud.delete_renter(db=db, renter_id=renter_id)
    if not success:
        raise HTTPException(status_code=404, detail="Renter not found")
    return {"message": f"Renter {renter_id} deleted successfully"}


