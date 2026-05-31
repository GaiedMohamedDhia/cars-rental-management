

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from datetime import datetime

try:
    from .database import Base
except ImportError:
    from database import Base

# --- User (login) model ---
class User(Base):
    """User model for authentication (register/login)"""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    nom = Column(String, nullable=True)
    prenom = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    telephone = Column(String, nullable=True)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# --- Maintenance model ---
class Maintenance(Base):
    __tablename__ = "maintenance"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    voiture_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    type_maintenance = Column(String, nullable=False)
    date_maintenance = Column(DateTime, default=datetime.utcnow)
    prochaine_maintenance = Column(DateTime, nullable=True)
    cout = Column(Float, nullable=True)
    kilometrage = Column(Integer, nullable=True)
    description = Column(String, nullable=True)
    statut = Column(String, default="OK")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
"""
SQLAlchemy Database Models
These models match the Prisma schema exactly (camelCase columns)
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

try:
    from .database import Base
except ImportError:
    from database import Base


class Car(Base):
    """Car model (Voiture)"""
    __tablename__ = "cars"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    numImma = Column(String, unique=True, index=True, nullable=False)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    kilometrage = Column(Integer, nullable=False)
    etat = Column(Integer, default=0, nullable=False)  # 0: available, 1: rented
    prixLocation = Column(Float, nullable=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    rentals = relationship("Rental", back_populates="car")


class Renter(Base):
    """Renter model (Locataire)"""
    __tablename__ = "renters"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    adresse = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    rentals = relationship("Rental", back_populates="renter")


class Rental(Base):
    """Rental model (Location)"""
    __tablename__ = "rentals"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    carId = Column(Integer, ForeignKey("cars.id"), nullable=False)
    renterId = Column(Integer, ForeignKey("renters.id"), nullable=False)
    dateDebut = Column(DateTime, default=datetime.utcnow)
    dateFin = Column(DateTime, nullable=True)
    kmDebut = Column(Integer, nullable=False)
    kmFin = Column(Integer, nullable=True)
    montantTotal = Column(Float, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    car = relationship("Car", back_populates="rentals")
    renter = relationship("Renter", back_populates="rentals")
