"""
Maintenance routes for creating, listing, and updating maintenance records
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

try:
    from .. import models, schemas
    from ..database import get_db
except ImportError:
    import models, schemas
    from database import get_db

router = APIRouter(
    prefix="/maintenance",
    tags=["Maintenance"],
)

@router.post("/", response_model=schemas.MaintenanceResponse, status_code=201)
def create_maintenance(item: schemas.MaintenanceCreate, db: Session = Depends(get_db)):
    data = item.model_dump()
    if not data.get("date_maintenance"):
        data["date_maintenance"] = datetime.utcnow()
    db_item = models.Maintenance(**data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/", response_model=List[schemas.MaintenanceResponse])
def list_maintenance(db: Session = Depends(get_db)):
    return db.query(models.Maintenance).all()

@router.get("/{item_id}", response_model=schemas.MaintenanceResponse)
def get_maintenance(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Maintenance).filter(models.Maintenance.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Maintenance not found")
    return item

@router.delete("/{item_id}")
def delete_maintenance(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Maintenance).filter(models.Maintenance.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Maintenance not found")
    db.delete(item)
    db.commit()
    return {"message": "deleted"}
