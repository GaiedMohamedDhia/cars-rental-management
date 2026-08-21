from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, model_validator


# ============== Car Schemas ==============

class CarBase(BaseModel):
    """Base schema for Car"""
    numImma: str = Field(..., description="Registration number")
    marque: str = Field(..., description="Brand")
    modele: str = Field(..., description="Model")
    photoUrl: Optional[str] = Field(None, max_length=4_200_000)
    annee: Optional[int] = Field(None, ge=1886, le=2100)
    carburant: Optional[str] = None
    transmission: Optional[str] = None
    nombrePlaces: Optional[int] = Field(None, ge=1, le=100)
    couleur: Optional[str] = None
    categorie: Optional[str] = None
    kilometrage: int = Field(..., ge=0, description="Mileage (must be >= 0)")
    etat: int = Field(default=0, ge=0, le=3, description="0=available, 1=rented, 2=maintenance, 3=unavailable")
    prixLocation: float = Field(..., gt=0, description="Rental price per day (must be > 0)")


class CarCreate(CarBase):
    """Schema for creating a new car"""
    pass


class CarUpdate(BaseModel):
    """Schema for updating a car (all fields optional)"""
    numImma: Optional[str] = None
    marque: Optional[str] = None
    modele: Optional[str] = None
    photoUrl: Optional[str] = Field(None, max_length=4_200_000)
    annee: Optional[int] = Field(None, ge=1886, le=2100)
    carburant: Optional[str] = None
    transmission: Optional[str] = None
    nombrePlaces: Optional[int] = Field(None, ge=1, le=100)
    couleur: Optional[str] = None
    categorie: Optional[str] = None
    kilometrage: Optional[int] = Field(None, ge=0)
    etat: Optional[int] = Field(None, ge=0, le=3)
    prixLocation: Optional[float] = Field(None, gt=0)


class CarResponse(CarBase):
    """Schema for car response"""
    id: int
    is_active: bool = True
    createdAt: datetime
    updatedAt: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('createdAt', 'updatedAt')
    def serialize_datetime(self, dt: datetime, _info) -> str:
        """Convert datetime to ISO format string"""
        return dt.isoformat() if dt else None


# ============== Auth Schemas ==============

class UserCreate(BaseModel):
    username: Optional[str] = Field(None, min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=8)
    password_confirmation: str = Field(..., min_length=8)
    nom: Optional[str] = None
    prenom: Optional[str] = None
    telephone: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    sexe: Optional[str] = None
    poste: Optional[str] = None
    photoUrl: Optional[str] = Field(None, max_length=2_800_000)

    @model_validator(mode="after")
    def validate_passwords(self):
        if self.password != self.password_confirmation:
            raise ValueError("Le mot de passe et sa confirmation doivent correspondre")
        if self.photoUrl and not self.photoUrl.startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")):
            raise ValueError("Format de photo non autorisé")
        return self


class UserLogin(BaseModel):
    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    nom: str
    prenom: str
    telephone: Optional[str] = None
    age: Optional[int] = None
    sexe: Optional[str] = None
    poste: Optional[str] = None
    photoUrl: Optional[str] = None
    last_login: Optional[datetime] = None
    role: str = "user"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "last_login")
    def serialize_datetime(self, dt: datetime, _info) -> str:
        return dt.isoformat() if dt else None


class UserUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    telephone: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    sexe: Optional[str] = None
    poste: Optional[str] = None
    photoUrl: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============== Renter Schemas ==============

class RenterBase(BaseModel):
    """Base schema for Renter"""
    nom: str = Field(..., min_length=1, description="Last name")
    prenom: str = Field(..., min_length=1, description="First name")
    adresse: str = Field(..., min_length=1, description="Address")
    telephone: Optional[str] = None
    email: Optional[EmailStr] = None
    cin: Optional[str] = None
    ville: Optional[str] = None
    photoUrl: Optional[str] = Field(None, max_length=2_800_000)


class RenterCreate(RenterBase):
    """Schema for creating a new renter"""
    pass


class RenterUpdate(BaseModel):
    """Schema for updating a renter (all fields optional)"""
    nom: Optional[str] = Field(None, min_length=1)
    prenom: Optional[str] = Field(None, min_length=1)
    adresse: Optional[str] = Field(None, min_length=1)
    telephone: Optional[str] = None
    email: Optional[EmailStr] = None
    cin: Optional[str] = None
    ville: Optional[str] = None
    photoUrl: Optional[str] = Field(None, max_length=2_800_000)


class RenterResponse(RenterBase):
    """Schema for renter response"""
    id: int
    is_active: bool = True
    createdAt: datetime
    updatedAt: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('createdAt', 'updatedAt')
    def serialize_datetime(self, dt: datetime, _info) -> str:
        """Convert datetime to ISO format string"""
        return dt.isoformat() if dt else None


# ============== Rental Schemas ==============

class RentalBase(BaseModel):
    """Base schema for Rental"""
    carId: int = Field(..., gt=0, description="Car ID")
    renterId: int = Field(..., gt=0, description="Renter ID")
    kmDebut: int = Field(..., ge=0, description="Starting mileage")


class RentalCreate(RentalBase):
    """Schema for creating a new rental"""
    dateDebut: Optional[str] = None  # ISO format string
    dateFin: Optional[str] = None  # ISO format string - planned end date
    dateFinPrevue: Optional[str] = None
    montantTotal: Optional[float] = None  # Pre-calculated total amount


class RentalUpdate(BaseModel):
    """Schema for updating a rental (for returning a car)"""
    carId: Optional[int] = Field(None, gt=0)
    renterId: Optional[int] = Field(None, gt=0)
    dateDebut: Optional[str] = None
    dateFin: Optional[str] = None  # Backward-compatible planned end date
    dateFinPrevue: Optional[str] = None
    dateRetourReelle: Optional[str] = None
    kmDebut: Optional[int] = Field(None, ge=0)
    kmFin: Optional[int] = Field(None, ge=0)
    montantTotal: Optional[float] = Field(None, ge=0)
    statut: Optional[str] = None


class RentalResponse(RentalBase):
    """Schema for rental response"""
    id: int
    dateDebut: datetime
    dateFin: Optional[datetime] = None
    dateFinPrevue: Optional[datetime] = None
    dateRetourReelle: Optional[datetime] = None
    kmFin: Optional[int] = None
    montantTotal: Optional[float] = None
    statut: str = "Active"
    createdAt: datetime
    updatedAt: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('dateDebut', 'dateFin', 'dateFinPrevue', 'dateRetourReelle', 'createdAt', 'updatedAt')
    def serialize_datetime(self, dt: datetime, _info) -> str:
        """Convert datetime to ISO format string"""
        return dt.isoformat() if dt else None


class RentalWithDetails(RentalResponse):
    """Schema for rental response with car and renter details"""
    car: CarResponse
    renter: RenterResponse
    
    model_config = ConfigDict(from_attributes=True)


# ============== Maintenance Schemas ==============

class MaintenanceBase(BaseModel):
    car_id: int = Field(..., gt=0)
    type_maintenance: str = Field(..., min_length=1)
    description: Optional[str] = None
    date_maintenance: Optional[datetime] = None
    cout: Optional[float] = Field(None, ge=0)
    kilometrage: Optional[int] = Field(None, ge=0)
    statut: Optional[str] = Field(default="Planifiée")


class MaintenanceCreate(MaintenanceBase):
    pass


class MaintenanceUpdate(BaseModel):
    car_id: Optional[int] = Field(None, gt=0)
    type_maintenance: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    date_maintenance: Optional[datetime] = None
    cout: Optional[float] = Field(None, ge=0)
    kilometrage: Optional[int] = Field(None, ge=0)
    statut: Optional[str] = None


class MaintenanceResponse(MaintenanceBase):
    id: int
    created_at: datetime
    updated_at: datetime
    car: Optional[CarResponse] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("date_maintenance", "created_at", "updated_at")
    def serialize_maintenance_datetime(self, dt: datetime, _info) -> str:
        return dt.isoformat() if dt else None


class PaymentCreate(BaseModel):
    rental_id: int = Field(..., gt=0)
    amount: float = Field(..., gt=0)
    method: Literal["Espèces", "Carte bancaire", "Virement bancaire", "Chèque"]
    payment_date: Optional[datetime] = None
    reference: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)


class PaymentUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    method: Optional[Literal["Espèces", "Carte bancaire", "Virement bancaire", "Chèque"]] = None
    status: Optional[Literal["Payé", "En attente", "Annulé", "Partiellement payé"]] = None
    payment_date: Optional[datetime] = None
    reference: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)


class PaymentResponse(PaymentCreate):
    id: int
    invoice_number: Optional[str] = None
    # Responses remain compatible with legacy rows while new writes are strictly validated.
    method: str
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    creator: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)


# ============== Generic Response Schemas ==============

class MessageResponse(BaseModel):
    """Generic message response"""
    message: str


class ErrorResponse(BaseModel):
    """Error response"""
    detail: str
