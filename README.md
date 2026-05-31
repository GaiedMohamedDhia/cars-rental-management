# 🚗 TuniCars+ - Système de Gestion de Location de Voitures

<div align="center">
  <img src="public/logo.png" alt="TuniCars+ Logo" width="200"/>
  
  **Une application web moderne pour la gestion de location de voitures**
  
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
</div>

---

## 📋 Table des Matières

- [Aperçu du Projet](#-aperçu-du-projet)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture du Projet](#-architecture-du-projet)
- [Technologies Utilisées](#-technologies-utilisées)
- [Structure du Projet](#-structure-du-projet)
- [Backend FastAPI (Python)](#-backend-fastapi-python)
- [Frontend Next.js](#-frontend-nextjs)
- [Base de Données](#-base-de-données)
- [Installation et Configuration](#-installation-et-configuration)
- [Déploiement Docker](#-déploiement-docker)
- [API Documentation](#-api-documentation)
- [Auteurs](#-auteurs)

---

## 🎯 Aperçu du Projet

**TuniCars+** est une application web complète de gestion de location de voitures développée dans le cadre d'un projet de fin d'année (PFA) en Programmation Python. L'application permet de gérer efficacement un parc automobile, les locataires et les locations.

### Objectifs du Projet
- Gérer un parc de voitures (CRUD complet)
- Gérer les locataires (clients)
- Gérer les locations (avec calcul automatique des prix)
- Afficher des statistiques et revenus
- Interface utilisateur moderne et responsive

---

## ✨ Fonctionnalités

### 🚙 Gestion des Voitures
- Ajouter, modifier, supprimer des voitures
- Suivi du kilométrage
- Gestion de l'état (disponible/louée)
- Prix de location par jour

### 👥 Gestion des Locataires
- Ajouter, modifier, supprimer des locataires
- Informations personnelles (nom, prénom, adresse)
- Historique des locations par locataire

### 📋 Gestion des Locations
- Créer une nouvelle location
- Sélection de la date de fin prévue
- Calcul automatique du prix total
- Retour de voiture avec mise à jour du kilométrage
- Historique des locations

### 📊 Tableau de Bord (Dashboard)
- Statistiques en temps réel
- Nombre de voitures (disponibles/louées)
- Nombre de locataires
- Locations actives
- **Revenus par période** (Aujourd'hui, Cette semaine, Ce mois)

---

## 🏗 Architecture du Projet

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │ Components  │  │    API Client           │  │
│  │  (App Dir)  │  │   (React)   │  │  (fetch → FastAPI)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                              │                                    │
│                    Prisma (Schema & Migrations)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP REST API
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI/Python)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Routers   │  │   Schemas   │  │      CRUD Operations    │  │
│  │ (Endpoints) │  │  (Pydantic) │  │      (SQLAlchemy)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                              │                                    │
│                    SQLAlchemy ORM                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL 16)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    cars     │  │   renters   │  │        rentals          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Technologies Utilisées

### Backend (Python)
| Technologie | Version | Description |
|-------------|---------|-------------|
| **Python** | 3.11+ | Langage de programmation |
| **FastAPI** | 0.104.1 | Framework web moderne et performant |
| **Uvicorn** | 0.24.0 | Serveur ASGI haute performance |
| **SQLAlchemy** | 2.0.23 | ORM (Object-Relational Mapping) |
| **Pydantic** | 2.5.0 | Validation des données |
| **Psycopg2** | 2.9.9 | Driver PostgreSQL |

### Frontend (TypeScript/JavaScript)
| Technologie | Version | Description |
|-------------|---------|-------------|
| **Next.js** | 16.0.3 | Framework React avec SSR |
| **React** | 19 | Bibliothèque UI |
| **TypeScript** | 5.x | Typage statique |
| **Tailwind CSS** | 3.x | Framework CSS utility-first |
| **Prisma** | 6.x | ORM pour migrations |

### Infrastructure
| Technologie | Version | Description |
|-------------|---------|-------------|
| **PostgreSQL** | 16 | Base de données relationnelle |
| **Docker** | Latest | Conteneurisation |
| **Docker Compose** | 3.8 | Orchestration des conteneurs |

---

## 📁 Structure du Projet

```
cars-rental/
│
├── 📂 backend/                    # Backend FastAPI (Python)
│   ├── __init__.py
│   ├── main.py                    # Point d'entrée FastAPI
│   ├── database.py                # Configuration base de données
│   ├── models.py                  # Modèles SQLAlchemy
│   ├── schemas.py                 # Schémas Pydantic
│   ├── crud.py                    # Opérations CRUD
│   ├── run.py                     # Script de démarrage
│   ├── requirements.txt           # Dépendances Python
│   └── 📂 routers/                # Endpoints API
│       ├── __init__.py
│       ├── cars.py                # Routes /cars
│       ├── renters.py             # Routes /renters
│       └── rentals.py             # Routes /rentals
│
├── 📂 app/                        # Frontend Next.js (App Router)
│   ├── layout.tsx                 # Layout principal
│   ├── page.tsx                   # Page d'accueil (Dashboard)
│   ├── globals.css                # Styles globaux
│   ├── 📂 cars/                   # Pages voitures
│   │   ├── page.tsx               # Liste des voitures
│   │   ├── 📂 new/
│   │   │   └── page.tsx           # Nouvelle voiture
│   │   └── 📂 [id]/
│   │       ├── page.tsx           # Détails voiture
│   │       └── 📂 edit/
│   │           └── page.tsx       # Modifier voiture
│   ├── 📂 renters/                # Pages locataires
│   │   └── (même structure)
│   └── 📂 rentals/                # Pages locations
│       └── (même structure)
│
├── 📂 components/                 # Composants React réutilisables
│   ├── CarForm.tsx                # Formulaire voiture
│   ├── RenterForm.tsx             # Formulaire locataire
│   ├── RentalForm.tsx             # Formulaire location
│   ├── ReturnCarForm.tsx          # Formulaire retour voiture
│   ├── DeleteCarButton.tsx        # Bouton suppression voiture
│   ├── DeleteRenterButton.tsx     # Bouton suppression locataire
│   └── SearchRenters.tsx          # Recherche locataires
│
├── 📂 lib/                        # Utilitaires
│   ├── api-client.ts              # Client API (fetch vers FastAPI)
│   └── prisma.ts                  # Client Prisma
│
├── 📂 types/                      # Types TypeScript
│   ├── index.d.ts                 # Export des types
│   ├── cars.d.ts                  # Types voitures
│   ├── renters.d.ts               # Types locataires
│   ├── rentals.d.ts               # Types locations
│   └── api.d.ts                   # Types API
│
├── 📂 prisma/                     # Configuration Prisma
│   ├── schema.prisma              # Schéma de la base de données
│   ├── seed.ts                    # Données initiales
│   └── 📂 migrations/             # Migrations SQL
│
├── 📂 public/                     # Fichiers statiques
│   └── logo.png
│
├── 📄 docker-compose.yml          # Configuration Docker
├── 📄 Dockerfile.frontend         # Image Docker frontend
├── 📄 Dockerfile.backend          # Image Docker backend
├── 📄 package.json                # Dépendances Node.js
├── 📄 next.config.ts              # Configuration Next.js
├── 📄 tsconfig.json               # Configuration TypeScript
└── 📄 README.md                   # Ce fichier
```

---

## 🐍 Backend FastAPI (Python)

### Structure du Backend

Le backend suit une architecture en couches claire et maintenable :

```
backend/
├── main.py          # Application FastAPI + Configuration CORS
├── database.py      # Connexion PostgreSQL avec SQLAlchemy
├── models.py        # Modèles ORM (Car, Renter, Rental)
├── schemas.py       # Schémas Pydantic pour validation
├── crud.py          # Opérations CRUD (Create, Read, Update, Delete)
└── routers/         # Routes API organisées par ressource
    ├── cars.py      # Endpoints /cars/*
    ├── renters.py   # Endpoints /renters/*
    └── rentals.py   # Endpoints /rentals/*
```

### Modèles de Données (models.py)

```python
# Modèle Voiture
class Car(Base):
    __tablename__ = "cars"
    
    id = Column(Integer, primary_key=True)
    numImma = Column(String, unique=True)      # Numéro d'immatriculation
    marque = Column(String)                     # Marque
    modele = Column(String)                     # Modèle
    kilometrage = Column(Integer)               # Kilométrage actuel
    etat = Column(Integer, default=0)           # 0: disponible, 1: louée
    prixLocation = Column(Float)                # Prix par jour (DT)
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)

# Modèle Locataire
class Renter(Base):
    __tablename__ = "renters"
    
    id = Column(Integer, primary_key=True)
    nom = Column(String)                        # Nom de famille
    prenom = Column(String)                     # Prénom
    adresse = Column(String)                    # Adresse
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)

# Modèle Location
class Rental(Base):
    __tablename__ = "rentals"
    
    id = Column(Integer, primary_key=True)
    carId = Column(Integer, ForeignKey("cars.id"))
    renterId = Column(Integer, ForeignKey("renters.id"))
    dateDebut = Column(DateTime)                # Date de début
    dateFin = Column(DateTime, nullable=True)   # Date de fin (null si active)
    kmDebut = Column(Integer)                   # Kilométrage au départ
    kmFin = Column(Integer, nullable=True)      # Kilométrage au retour
    montantTotal = Column(Float, nullable=True) # Montant total calculé
```

### Schémas Pydantic (schemas.py)

Les schémas Pydantic assurent la validation des données entrantes et sortantes :

```python
# Schéma de création d'une voiture
class CarCreate(BaseModel):
    numImma: str
    marque: str
    modele: str
    kilometrage: int
    prixLocation: float
    etat: int = 0

# Schéma de réponse
class CarResponse(CarCreate):
    id: int
    createdAt: datetime
    updatedAt: datetime
```

### Points d'Entrée API (Routers)

| Fichier | Préfixe | Description |
|---------|---------|-------------|
| `cars.py` | `/cars` | Gestion des voitures |
| `renters.py` | `/renters` | Gestion des locataires |
| `rentals.py` | `/rentals` | Gestion des locations |

### Configuration CORS (main.py)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Démarrage du Backend

```bash
# Méthode 1: Avec uvicorn directement
cd backend
uvicorn main:app --reload --port 8000

# Méthode 2: Avec le script run.py
cd backend
python run.py
```

---

## ⚛️ Frontend Next.js

### App Router (Next.js 16)

Le frontend utilise le nouveau **App Router** de Next.js avec :
- **Server Components** pour le rendu côté serveur
- **Client Components** pour l'interactivité

### Pages Principales

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Tableau de bord avec statistiques |
| `/cars` | Liste voitures | Affiche toutes les voitures |
| `/cars/new` | Nouvelle voiture | Formulaire d'ajout |
| `/cars/[id]` | Détails voiture | Informations et historique |
| `/renters` | Liste locataires | Affiche tous les locataires |
| `/renters/new` | Nouveau locataire | Formulaire d'ajout |
| `/rentals` | Liste locations | Locations actives et historique |
| `/rentals/new` | Nouvelle location | Formulaire de location |

### Client API (lib/api-client.ts)

Le client API centralise toutes les communications avec le backend :

```typescript
// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

// Exemple d'utilisation
export const carsAPI = {
  getAll: async () => apiFetch<Car[]>('/cars'),
  getById: async (id: number) => apiFetch<Car>(`/cars/${id}`),
  create: async (data: CreateCarInput) => apiFetch<Car>('/cars', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: async (id: number, data: UpdateCarInput) => apiFetch<Car>(`/cars/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: async (id: number) => apiFetch(`/cars/${id}`, {
    method: 'DELETE',
  }),
}
```

---

## 🗄 Base de Données

### Schéma de la Base de Données

```
┌─────────────────────┐       ┌─────────────────────┐
│       cars          │       │      renters        │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │
│ numImma (UNIQUE)    │       │ nom                 │
│ marque              │       │ prenom              │
│ modele              │       │ adresse             │
│ kilometrage         │       │ createdAt           │
│ etat                │       │ updatedAt           │
│ prixLocation        │       └─────────────────────┘
│ createdAt           │                │
│ updatedAt           │                │
└─────────────────────┘                │
         │                             │
         │      ┌─────────────────────┐│
         │      │      rentals        ││
         │      ├─────────────────────┤│
         └──────│ carId (FK)          ││
                │ renterId (FK) ───────┘
                │ id (PK)             │
                │ dateDebut           │
                │ dateFin             │
                │ kmDebut             │
                │ kmFin               │
                │ montantTotal        │
                │ createdAt           │
                │ updatedAt           │
                └─────────────────────┘
```

### Relations

- **Car → Rental** : One-to-Many (Une voiture peut avoir plusieurs locations)
- **Renter → Rental** : One-to-Many (Un locataire peut avoir plusieurs locations)

---

## 🚀 Installation et Configuration

### Prérequis

- **Python** 3.11 ou supérieur
- **Node.js** 18 ou supérieur
- **PostgreSQL** 14 ou supérieur
- **npm** ou **pnpm**

### 1. Cloner le Repository

```bash
git clone https://github.com/votre-username/cars-rental.git
cd cars-rental
```

### 2. Configuration de l'Environnement

Créer un fichier `.env` à la racine :

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cars-rental?schema=public"

# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_HEALTH=/health
NEXT_PUBLIC_API_ROOT=/
NEXT_PUBLIC_API_CARS_BASE=/cars
NEXT_PUBLIC_API_CARS_GET_ALL=/cars
NEXT_PUBLIC_API_CARS_GET_BY_ID=/cars/{id}
NEXT_PUBLIC_API_CARS_CREATE=/cars
NEXT_PUBLIC_API_CARS_UPDATE=/cars/{id}
NEXT_PUBLIC_API_CARS_DELETE=/cars/{id}
NEXT_PUBLIC_API_RENTERS_BASE=/renters
NEXT_PUBLIC_API_RENTERS_GET_ALL=/renters
NEXT_PUBLIC_API_RENTERS_GET_BY_ID=/renters/{id}
NEXT_PUBLIC_API_RENTERS_CREATE=/renters
NEXT_PUBLIC_API_RENTERS_UPDATE=/renters/{id}
NEXT_PUBLIC_API_RENTERS_DELETE=/renters/{id}
NEXT_PUBLIC_API_RENTERS_SEARCH=/renters
NEXT_PUBLIC_API_RENTALS_BASE=/rentals
NEXT_PUBLIC_API_RENTALS_GET_ALL=/rentals
NEXT_PUBLIC_API_RENTALS_GET_BY_ID=/rentals/{id}
NEXT_PUBLIC_API_RENTALS_GET_BY_CAR=/rentals/car/{car_id}
NEXT_PUBLIC_API_RENTALS_GET_BY_RENTER=/rentals/renter/{renter_id}
NEXT_PUBLIC_API_RENTALS_CREATE=/rentals
NEXT_PUBLIC_API_RENTALS_UPDATE=/rentals/{id}
NEXT_PUBLIC_API_RENTALS_DELETE=/rentals/{id}
```

### 3. Installation du Backend (Python)

```bash
# Créer un environnement virtuel
python -m venv venv

# Activer l'environnement (Windows)
.\venv\Scripts\activate

# Activer l'environnement (Linux/Mac)
source venv/bin/activate

# Installer les dépendances
pip install -r backend/requirements.txt
```

### 4. Installation du Frontend (Node.js)

```bash
# Installer les dépendances
npm install

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma db push
```

### 5. Démarrage en Développement

**Terminal 1 - Backend :**
```bash
cd backend
python run.py
```

**Terminal 2 - Frontend :**
```bash
npm run dev
```

### 6. Accès à l'Application

- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs

---

## 🐳 Déploiement Docker

### Démarrage Rapide

```bash
# Construire et démarrer tous les services
docker-compose up -d

# Vérifier le statut
docker-compose ps

# Voir les logs
docker-compose logs -f
```

### Services Docker

| Service | Port | Description |
|---------|------|-------------|
| `database` | 5432 | PostgreSQL 16 |
| `backend` | 8000 | FastAPI |
| `frontend` | 3000 | Next.js |

### Commandes Utiles

```bash
# Arrêter les services
docker-compose down

# Reconstruire les images
docker-compose build --no-cache

# Supprimer les volumes (⚠️ supprime les données)
docker-compose down -v
```

---

## 📚 API Documentation

### Endpoints Disponibles

L'API REST complète est disponible à :
- **Swagger UI** : http://localhost:8000/docs
- **ReDoc** : http://localhost:8000/redoc

### Résumé des Endpoints

#### 🚗 Cars (Voitures)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/cars` | Liste toutes les voitures |
| GET | `/cars/{id}` | Détails d'une voiture |
| POST | `/cars` | Créer une voiture |
| PUT | `/cars/{id}` | Modifier une voiture |
| DELETE | `/cars/{id}` | Supprimer une voiture |

#### 👥 Renters (Locataires)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/renters` | Liste tous les locataires |
| GET | `/renters/{id}` | Détails d'un locataire |
| POST | `/renters` | Créer un locataire |
| PUT | `/renters/{id}` | Modifier un locataire |
| DELETE | `/renters/{id}` | Supprimer un locataire |

#### 📋 Rentals (Locations)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/rentals` | Liste toutes les locations |
| GET | `/rentals/{id}` | Détails d'une location |
| GET | `/rentals/car/{car_id}` | Locations d'une voiture |
| GET | `/rentals/renter/{renter_id}` | Locations d'un locataire |
| POST | `/rentals` | Créer une location |
| PUT | `/rentals/{id}` | Modifier/Terminer une location |
| DELETE | `/rentals/{id}` | Supprimer une location |

#### 🔧 System
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Informations API |
| GET | `/health` | Health check |

---

## 📸 Captures d'Écran

### Dashboard
Le tableau de bord affiche les statistiques principales :
- Total des voitures (disponibles/louées)
- Total des locataires
- Locations actives
- Revenus (total, aujourd'hui, cette semaine, ce mois)

### Gestion des Voitures
Liste des voitures avec état (disponible/louée), prix, et actions CRUD.

### Nouvelle Location
Formulaire avec :
- Sélection de voiture
- Sélection de locataire
- Date de fin prévue
- Calcul automatique du prix estimé

---

## 👨‍💻 Auteurs

**Projet de Fin d'Année (PFA)** - Programmation Python

- **École** : ING2
- **Année** : 2026

---

## 📄 Licence

Ce projet est développé dans un cadre académique.

---

<div align="center">
  <p>Made with ❤️ using FastAPI & Next.js</p>
</div>
