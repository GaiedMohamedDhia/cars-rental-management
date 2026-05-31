# 🐍 Backend FastAPI - Documentation Technique

## Architecture du Backend

Le backend est construit avec **FastAPI**, un framework Python moderne et performant pour la création d'APIs REST.

```
backend/
├── main.py              # Point d'entrée de l'application
├── database.py          # Configuration SQLAlchemy
├── models.py            # Modèles ORM
├── schemas.py           # Schémas Pydantic
├── crud.py              # Opérations CRUD
├── run.py               # Script de démarrage
├── requirements.txt     # Dépendances Python
└── routers/             # Endpoints API
    ├── __init__.py
    ├── cars.py          # Routes /cars
    ├── renters.py       # Routes /renters
    └── rentals.py       # Routes /rentals
```

---

## 📦 Dépendances (requirements.txt)

```
fastapi==0.104.1          # Framework web
uvicorn[standard]==0.24.0 # Serveur ASGI
sqlalchemy==2.0.23        # ORM
psycopg2-binary==2.9.9    # Driver PostgreSQL
pydantic==2.5.0           # Validation
python-dotenv==1.0.0      # Variables d'environnement
```

---

## 🗂 Fichiers Détaillés

### 1. main.py - Point d'Entrée

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Création de l'application
app = FastAPI(
    title="Car Rental Management API",
    version="1.0.0",
    docs_url="/docs",      # Swagger UI
    redoc_url="/redoc"     # ReDoc
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routers
app.include_router(cars.router)
app.include_router(renters.router)
app.include_router(rentals.router)
```

**Endpoints racine :**
- `GET /` - Informations API
- `GET /health` - Health check

---

### 2. database.py - Configuration Base de Données

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# URL de connexion PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cars-rental")

# Création du moteur SQLAlchemy
engine = create_engine(DATABASE_URL)

# Session locale
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()

# Dependency injection pour les routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### 3. models.py - Modèles SQLAlchemy

#### Modèle Car (Voiture)
```python
class Car(Base):
    __tablename__ = "cars"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    numImma = Column(String, unique=True, index=True)  # Immatriculation
    marque = Column(String)                             # Marque
    modele = Column(String)                             # Modèle
    kilometrage = Column(Integer)                       # Kilométrage
    etat = Column(Integer, default=0)                   # 0=disponible, 1=louée
    prixLocation = Column(Float)                        # Prix/jour
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relation One-to-Many avec Rental
    rentals = relationship("Rental", back_populates="car")
```

#### Modèle Renter (Locataire)
```python
class Renter(Base):
    __tablename__ = "renters"
    
    id = Column(Integer, primary_key=True)
    nom = Column(String)          # Nom de famille
    prenom = Column(String)       # Prénom
    adresse = Column(String)      # Adresse
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)
    
    rentals = relationship("Rental", back_populates="renter")
```

#### Modèle Rental (Location)
```python
class Rental(Base):
    __tablename__ = "rentals"
    
    id = Column(Integer, primary_key=True)
    carId = Column(Integer, ForeignKey("cars.id"))
    renterId = Column(Integer, ForeignKey("renters.id"))
    dateDebut = Column(DateTime)           # Date de début
    dateFin = Column(DateTime, nullable=True)    # Date de fin (null si active)
    kmDebut = Column(Integer)              # Km au départ
    kmFin = Column(Integer, nullable=True)       # Km au retour
    montantTotal = Column(Float, nullable=True)  # Prix total calculé
    
    # Relations
    car = relationship("Car", back_populates="rentals")
    renter = relationship("Renter", back_populates="rentals")
```

---

### 4. schemas.py - Schémas Pydantic

Pydantic assure la **validation des données** et la **sérialisation**.

#### Schémas Car
```python
class CarBase(BaseModel):
    numImma: str
    marque: str
    modele: str
    kilometrage: int = Field(ge=0)
    prixLocation: float = Field(gt=0)
    etat: int = Field(default=0, ge=0, le=1)

class CarCreate(CarBase):
    pass

class CarUpdate(BaseModel):
    numImma: Optional[str] = None
    marque: Optional[str] = None
    modele: Optional[str] = None
    kilometrage: Optional[int] = Field(None, ge=0)
    prixLocation: Optional[float] = Field(None, gt=0)
    etat: Optional[int] = Field(None, ge=0, le=1)

class CarResponse(CarBase):
    id: int
    createdAt: datetime
    updatedAt: datetime
    rentals: List[RentalBase] = []
    
    class Config:
        from_attributes = True
```

#### Schémas Rental avec calcul du prix
```python
class RentalCreate(RentalBase):
    dateDebut: Optional[str] = None
    dateFin: Optional[str] = None      # Date de fin prévue
    montantTotal: Optional[float] = None  # Prix pré-calculé
```

---

### 5. crud.py - Opérations CRUD

Fonctions pour interagir avec la base de données :

```python
# ===== CARS =====

def get_cars(db: Session, skip: int = 0, limit: int = 100):
    """Récupérer toutes les voitures"""
    return db.query(models.Car).offset(skip).limit(limit).all()

def get_car(db: Session, car_id: int):
    """Récupérer une voiture par ID"""
    return db.query(models.Car).filter(models.Car.id == car_id).first()

def create_car(db: Session, car: schemas.CarCreate):
    """Créer une nouvelle voiture"""
    db_car = models.Car(**car.model_dump())
    db.add(db_car)
    db.commit()
    db.refresh(db_car)
    return db_car

def update_car(db: Session, car_id: int, car: schemas.CarUpdate):
    """Mettre à jour une voiture"""
    db_car = get_car(db, car_id)
    if db_car:
        update_data = car.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_car, key, value)
        db_car.updatedAt = datetime.utcnow()
        db.commit()
        db.refresh(db_car)
    return db_car

def delete_car(db: Session, car_id: int):
    """Supprimer une voiture"""
    db_car = get_car(db, car_id)
    if db_car:
        db.delete(db_car)
        db.commit()
    return db_car
```

#### Logique métier - Création de location
```python
def create_rental(db: Session, rental: schemas.RentalCreate):
    """Créer une nouvelle location avec calcul automatique du prix"""
    
    # Récupérer la voiture
    car = db.query(models.Car).filter(models.Car.id == rental.carId).first()
    
    # Calculer le montant si date de fin fournie
    montant = None
    if rental.dateFin and car:
        date_debut = datetime.fromisoformat(rental.dateDebut) if rental.dateDebut else datetime.utcnow()
        date_fin = datetime.fromisoformat(rental.dateFin)
        jours = (date_fin - date_debut).days
        if jours > 0:
            montant = jours * car.prixLocation
    
    # Créer la location
    db_rental = models.Rental(
        carId=rental.carId,
        renterId=rental.renterId,
        kmDebut=rental.kmDebut,
        montantTotal=montant or rental.montantTotal
    )
    
    # Marquer la voiture comme louée
    if car:
        car.etat = 1
    
    db.add(db_rental)
    db.commit()
    db.refresh(db_rental)
    return db_rental
```

---

### 6. routers/ - Endpoints API

#### routers/cars.py

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/cars", tags=["Cars"])

@router.get("/", response_model=List[CarResponse])
def read_cars(
    skip: int = 0,
    limit: int = 100,
    available_only: bool = False,
    db: Session = Depends(get_db)
):
    """Liste toutes les voitures"""
    if available_only:
        return crud.get_available_cars(db)
    return crud.get_cars(db, skip=skip, limit=limit)

@router.get("/{car_id}", response_model=CarResponse)
def read_car(car_id: int, db: Session = Depends(get_db)):
    """Récupère une voiture par son ID"""
    db_car = crud.get_car(db, car_id=car_id)
    if db_car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return db_car

@router.post("/", response_model=CarResponse, status_code=201)
def create_car(car: CarCreate, db: Session = Depends(get_db)):
    """Crée une nouvelle voiture"""
    return crud.create_car(db=db, car=car)

@router.put("/{car_id}", response_model=CarResponse)
def update_car(car_id: int, car: CarUpdate, db: Session = Depends(get_db)):
    """Met à jour une voiture"""
    db_car = crud.update_car(db, car_id=car_id, car=car)
    if db_car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return db_car

@router.delete("/{car_id}")
def delete_car(car_id: int, db: Session = Depends(get_db)):
    """Supprime une voiture"""
    db_car = crud.delete_car(db, car_id=car_id)
    if db_car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return {"message": "Car deleted successfully"}
```

---

## 🚀 Démarrage

### Option 1 : Avec run.py
```bash
cd backend
python run.py
```

### Option 2 : Avec uvicorn
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Option 3 : En production
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 📖 Documentation API Interactive

Une fois le serveur démarré :

- **Swagger UI** : http://localhost:8000/docs
- **ReDoc** : http://localhost:8000/redoc
- **OpenAPI JSON** : http://localhost:8000/openapi.json

---

## 🧪 Test des Endpoints

### Avec cURL

```bash
# Health check
curl http://localhost:8000/health

# Liste des voitures
curl http://localhost:8000/cars

# Créer une voiture
curl -X POST http://localhost:8000/cars \
  -H "Content-Type: application/json" \
  -d '{
    "numImma": "123-TN-456",
    "marque": "Toyota",
    "modele": "Corolla",
    "kilometrage": 50000,
    "prixLocation": 100.0
  }'

# Modifier une voiture
curl -X PUT http://localhost:8000/cars/1 \
  -H "Content-Type: application/json" \
  -d '{"kilometrage": 55000}'

# Supprimer une voiture
curl -X DELETE http://localhost:8000/cars/1
```

### Avec PowerShell

```powershell
# Créer une voiture
$body = @{
    numImma = "TEST-123"
    marque = "Ford"
    modele = "Focus"
    kilometrage = 25000
    prixLocation = 80.0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/cars" -Method Post -Body $body -ContentType "application/json"
```

---

## 🔧 Variables d'Environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://postgres:postgres@localhost:5432/cars-rental` |

---

## 📊 Diagramme de Séquence - Création de Location

```
Client          FastAPI         CRUD           Database
  |                |              |               |
  |--POST /rentals-|              |               |
  |                |--create_rental()             |
  |                |              |--get car------|
  |                |              |<--car data----|
  |                |              |               |
  |                |              |--calculate price
  |                |              |               |
  |                |              |--insert rental|
  |                |              |<--rental id---|
  |                |              |               |
  |                |              |--update car---|
  |                |              |   (etat=1)    |
  |                |<--rental data|               |
  |<--201 Created--|              |               |
```

---

## 🛡 Gestion des Erreurs

```python
# Erreurs HTTP standard
raise HTTPException(status_code=404, detail="Car not found")
raise HTTPException(status_code=400, detail="Invalid data")
raise HTTPException(status_code=409, detail="Car already rented")

# Gestionnaire global d'erreurs
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)}
    )
```
