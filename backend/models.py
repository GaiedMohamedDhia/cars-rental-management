 

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

try:
    from .database import Base
except ImportError:
    from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    telephone = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    sexe = Column(String, nullable=True)
    poste = Column(String, nullable=True)
    photoUrl = Column(String, nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    role = Column(String, default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    numImma = Column(String, unique=True, index=True, nullable=False)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    photoUrl = Column(String, nullable=True)
    annee = Column(Integer, nullable=True)
    carburant = Column(String, nullable=True)
    transmission = Column(String, nullable=True)
    nombrePlaces = Column(Integer, nullable=True)
    couleur = Column(String, nullable=True)
    categorie = Column(String, nullable=True)
    kilometrage = Column(Integer, nullable=False)
    etat = Column(Integer, default=0, nullable=False)
    prixLocation = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    rentals = relationship("Rental", back_populates="car")
    maintenances = relationship("Maintenance", back_populates="car", cascade="all, delete-orphan")


class Renter(Base):
    __tablename__ = "renters"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    adresse = Column(String, nullable=False)
    telephone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    cin = Column(String, nullable=True)
    ville = Column(String, nullable=True)
    photoUrl = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    rentals = relationship("Rental", back_populates="renter")


class Rental(Base):
    __tablename__ = "rentals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    carId = Column(Integer, ForeignKey("cars.id", ondelete="RESTRICT"), nullable=False)
    renterId = Column(Integer, ForeignKey("renters.id", ondelete="RESTRICT"), nullable=False)
    dateDebut = Column(DateTime, default=datetime.utcnow, nullable=False)
    dateFin = Column(DateTime, nullable=True)
    dateFinPrevue = Column(DateTime, nullable=True)
    dateRetourReelle = Column(DateTime, nullable=True)
    kmDebut = Column(Integer, nullable=False)
    kmFin = Column(Integer, nullable=True)
    statut = Column(String, default="Active", nullable=False)
    montantTotal = Column(Float, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    car = relationship("Car", back_populates="rentals")
    renter = relationship("Renter", back_populates="rentals")
    payments = relationship(
        "Payment",
        back_populates="rental",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String, unique=True, index=True, nullable=True)
    rental_id = Column(
        Integer,
        ForeignKey("rentals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)
    status = Column(String, default="Payé", nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    reference = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    rental = relationship("Rental", back_populates="payments")
    creator = relationship("User")


class Maintenance(Base):
    __tablename__ = "maintenances"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    car_id = Column(Integer, ForeignKey("cars.id", ondelete="CASCADE"), nullable=False, index=True)
    type_maintenance = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date_maintenance = Column(DateTime, default=datetime.utcnow, nullable=False)
    cout = Column(Float, nullable=True)
    kilometrage = Column(Integer, nullable=True)
    statut = Column(String, default="Planifiée", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    car = relationship("Car", back_populates="maintenances")
