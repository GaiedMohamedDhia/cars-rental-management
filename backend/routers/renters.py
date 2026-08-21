"""
Renter Routes - API endpoints for renter management
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path
from uuid import uuid4

try:
    from .. import crud, models, schemas
    from ..database import get_db
    from ..security import get_current_user
except ImportError:
    import crud, models, schemas
    from database import get_db
    from security import get_current_user

router = APIRouter(
    prefix="/renters",
    tags=["Renters"],
    responses={404: {"description": "Renter not found"}},
    dependencies=[Depends(get_current_user)],
)


def require_renter_delete_permission(current_user=Depends(get_current_user)):
    if (current_user.role or "").strip().lower() not in {"admin", "user"}:
        raise HTTPException(
            status_code=403,
            detail="Vous n’avez pas la permission de supprimer ce locataire.",
        )
    return current_user

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "renters"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_PHOTO_SIZE = 2 * 1024 * 1024
ALLOWED_PHOTO_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


def _is_valid_image(content: bytes, content_type: str) -> bool:
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    return False


def _delete_stored_photo(photo_url: Optional[str]) -> None:
    prefix = "/uploads/renters/"
    if not photo_url or not photo_url.startswith(prefix):
        return
    candidate = (UPLOAD_DIR / Path(photo_url).name).resolve()
    if candidate.parent == UPLOAD_DIR.resolve() and candidate.exists():
        candidate.unlink()


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


@router.post("/{renter_id}/photo", response_model=schemas.RenterResponse)
async def upload_renter_photo(
    renter_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    renter = crud.get_renter(db, renter_id=renter_id)
    if renter is None:
        raise HTTPException(status_code=404, detail="Renter not found")
    content_type = (photo.content_type or "").lower()
    if content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Format non autorisé. Utilisez PNG, JPG, JPEG ou WebP.")
    content = await photo.read(MAX_PHOTO_SIZE + 1)
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="La photo ne doit pas dépasser 2 Mo.")
    if not content or not _is_valid_image(content, content_type):
        raise HTTPException(status_code=400, detail="Le fichier fourni n'est pas une image valide.")

    filename = f"renter-{renter_id}-{uuid4().hex}{ALLOWED_PHOTO_TYPES[content_type]}"
    destination = UPLOAD_DIR / filename
    destination.write_bytes(content)
    old_photo = renter.photoUrl
    renter.photoUrl = f"/uploads/renters/{filename}"
    db.commit()
    db.refresh(renter)
    _delete_stored_photo(old_photo)
    return renter


@router.delete("/{renter_id}/photo", response_model=schemas.RenterResponse)
def delete_renter_photo(renter_id: int, db: Session = Depends(get_db)):
    renter = crud.get_renter(db, renter_id=renter_id)
    if renter is None:
        raise HTTPException(status_code=404, detail="Renter not found")
    old_photo = renter.photoUrl
    renter.photoUrl = None
    db.commit()
    db.refresh(renter)
    _delete_stored_photo(old_photo)
    return renter


@router.delete("/{renter_id}", response_model=schemas.MessageResponse)
def delete_renter(
    renter_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_renter_delete_permission),
):
    renter = db.query(models.Renter).filter(models.Renter.id == renter_id).first()
    if renter is None:
        raise HTTPException(status_code=404, detail="Locataire introuvable.")
    has_history = (
        db.query(models.Rental.id).filter(models.Rental.renterId == renter_id).first()
        is not None
    )
    if has_history:
        if not renter.is_active:
            return {"message": "Ce locataire est déjà archivé."}
        try:
            renter.is_active = False
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="L'archivage du locataire a échoué de manière inattendue.",
            ) from exc
        return {
            "message": (
                "Ce locataire possède un historique et a été archivé avec succès."
            )
        }
    old_photo = renter.photoUrl
    try:
        db.delete(renter)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Impossible de supprimer ce locataire car il possède des "
                "données associées."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="La suppression du locataire a échoué de manière inattendue.",
        ) from exc

    _delete_stored_photo(old_photo)
    return {"message": "Locataire supprimé avec succès."}
