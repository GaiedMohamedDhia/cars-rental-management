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
    prefix="/payments",
    tags=["Payments"],
    dependencies=[Depends(get_current_user)],
)


def payment_query(db: Session):
    return db.query(models.Payment).options(
        joinedload(models.Payment.creator),
        joinedload(models.Payment.rental).joinedload(models.Rental.car),
        joinedload(models.Payment.rental).joinedload(models.Rental.renter),
    )


def get_payment_or_404(db: Session, payment_id: int) -> models.Payment:
    payment = payment_query(db).filter(models.Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paiement introuvable")
    return payment


def calculated_status(
    db: Session,
    rental: models.Rental,
    amount: float,
    excluded_payment_id: int | None = None,
) -> str:
    query = db.query(models.Payment).filter(
        models.Payment.rental_id == rental.id,
        models.Payment.status.notin_(["Annulé", "AnnulÃ©"]),
    )
    if excluded_payment_id is not None:
        query = query.filter(models.Payment.id != excluded_payment_id)
    already_paid = sum(float(item.amount) for item in query.all())
    expected_total = float(rental.montantTotal) if rental.montantTotal is not None else None
    if expected_total is None:
        return "Payé"
    return "Partiellement payé" if already_paid + amount < expected_total else "Payé"


@router.get("/", response_model=List[schemas.PaymentResponse])
def list_payments(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return payment_query(db).order_by(models.Payment.created_at.desc()).all()


@router.get("/{payment_id}", response_model=schemas.PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return get_payment_or_404(db, payment_id)


@router.post("/", response_model=schemas.PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rental = db.query(models.Rental).filter(models.Rental.id == payload.rental_id).first()
    if rental is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location introuvable")

    payment = models.Payment(
        rental_id=payload.rental_id,
        amount=payload.amount,
        method=payload.method,
        status=calculated_status(db, rental, float(payload.amount)),
        payment_date=payload.payment_date or datetime.utcnow(),
        reference=payload.reference,
        notes=payload.notes,
        created_by=user.id,
    )
    try:
        db.add(payment)
        db.flush()
        payment.invoice_number = f"FAC-{payment.payment_date.year}-{payment.id:06d}"
        db.commit()
        return get_payment_or_404(db, payment.id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflit lors de la création du paiement",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Enregistrement du paiement impossible",
        ) from exc


@router.patch("/{payment_id}", response_model=schemas.PaymentResponse)
@router.put("/{payment_id}", response_model=schemas.PaymentResponse, include_in_schema=False)
def update_payment(
    payment_id: int,
    payload: schemas.PaymentUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    payment = get_payment_or_404(db, payment_id)
    values = payload.model_dump(exclude_unset=True)
    requested_status = values.pop("status", None)
    for field, value in values.items():
        setattr(payment, field, value)

    if requested_status in {"Annulé", "En attente"}:
        payment.status = requested_status
    else:
        payment.status = calculated_status(
            db,
            payment.rental,
            float(payment.amount),
            excluded_payment_id=payment.id,
        )

    try:
        db.commit()
        return get_payment_or_404(db, payment.id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Les nouvelles données du paiement sont en conflit",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Modification du paiement impossible",
        ) from exc


@router.delete("/{payment_id}", response_model=schemas.MessageResponse)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    payment = get_payment_or_404(db, payment_id)
    try:
        db.delete(payment)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce paiement ne peut pas être supprimé car une donnée associée le référence.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La suppression du paiement a échoué. Aucune donnée n’a été modifiée.",
        ) from exc
    return {"message": "Paiement supprimé définitivement."}
