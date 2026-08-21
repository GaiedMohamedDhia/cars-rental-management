# TuniCars+ - Gestion de location de voitures

<div align="center">
  <img src="./public/logo.png" alt="Logo TuniCars+" width="520" />

  <p><strong>CAR RENTAL MANAGEMENT</strong></p>
  <p>Application web moderne pour gérer un parc automobile, les locataires, les locations, les paiements et la maintenance.</p>

  [![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black?logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
  [![Kubernetes](https://img.shields.io/badge/Kubernetes-Minikube-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
</div>

---

## Sommaire

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Structure du projet](#structure-du-projet)
- [Installation locale](#installation-locale)
- [Démarrage avec Docker Compose](#démarrage-avec-docker-compose)
- [Déploiement Kubernetes](#déploiement-kubernetes)
- [Docker Swarm](#docker-swarm)
- [API FastAPI](#api-fastapi)
- [Configuration](#configuration)
- [Framework de résilience](#framework-de-résilience)
- [Sécurité et bonnes pratiques](#sécurité-et-bonnes-pratiques)

## Présentation

TuniCars+ est une application trois tiers destinée à la gestion quotidienne d'une agence de location de voitures :

- frontend Next.js utilisant l'App Router ;
- backend REST FastAPI protégé par JWT ;
- base de données PostgreSQL pilotée par SQLAlchemy ;
- proxy serveur Next.js entre le navigateur et FastAPI ;
- déploiements Docker Compose, Docker Swarm et Kubernetes/Minikube.

Dans le navigateur, les appels utilisent uniquement des chemins relatifs `/api/...`. Le serveur Next.js relaie les requêtes vers FastAPI grâce à `INTERNAL_API_BASE_URL`. Le nom interne Kubernetes `backend` n'est donc jamais exposé au client.

```text
Navigateur
   │  /api/...
   ▼
Next.js 16
   │  INTERNAL_API_BASE_URL
   ▼
FastAPI
   │  SQLAlchemy
   ▼
PostgreSQL 16
```

## Fonctionnalités

### Authentification et profil

- inscription et connexion JWT ;
- restauration de la session avec `/auth/me` ;
- profil utilisateur, photo, informations personnelles et poste ;
- modification du mot de passe ;
- enregistrement et affichage de la dernière connexion.

### Tableau de bord

- accueil personnalisé avec les données de l'utilisateur connecté ;
- indicateurs issus des données réelles ;
- état du parc et statut des locations ;
- historique récent des maintenances ;
- notifications calculées à partir des locations et maintenances existantes.

### Véhicules

- création, consultation, modification et suppression/archivage ;
- photo persistante, marque, modèle, année et immatriculation ;
- kilométrage, prix journalier et caractéristiques techniques ;
- états : disponible, louée, maintenance ou indisponible ;
- recherche et filtres avancés.

### Locataires

- création, consultation, modification et suppression/archivage ;
- photo, coordonnées, CIN, ville et adresse ;
- statistiques et historique des locations ;
- recherche instantanée et filtres.

### Locations

- création avec une voiture disponible et un locataire actif ;
- modification et consultation détaillée ;
- retour avec kilométrage final et date réelle ;
- distinction entre retour à temps, retour en retard et location encore en retard ;
- mise à jour automatique de l'état du véhicule ;
- historique des locations terminées.

### Paiements et factures

- paiements associés aux locations ;
- statuts payé, en attente, annulé ou partiellement payé ;
- numéro de facture unique ;
- aperçu, impression et génération PDF ;
- détails du client, du véhicule, de la location et du paiement.

### Maintenance

- liste, recherche, filtres et tri ;
- ajout, consultation, modification et suppression ;
- association à une voiture existante ;
- coût, kilométrage, date, type et statut ;
- export PDF et historique récent sur le Dashboard.

## Architecture

### Frontend

- pages : `app/` ;
- composants métier : `components/` ;
- client API : `lib/api-client.ts` ;
- proxy vers FastAPI : `app/api/[...path]/route.ts` ;
- types TypeScript : `types/` ;
- ressources visuelles : `public/` ;
- build Docker : mode Next.js `standalone`.

### Backend

- application FastAPI : `backend/main.py` ;
- modèles SQLAlchemy : `backend/models.py` ;
- schémas Pydantic : `backend/schemas.py` ;
- opérations de données : `backend/crud.py` ;
- sécurité JWT : `backend/security.py` ;
- routes : `backend/routers/` ;
- fichiers téléversés : `uploads/`.

### Données principales

- `users` ;
- `cars` ;
- `renters` ;
- `rentals` ;
- `payments` ;
- `maintenances`.

## Technologies

| Couche | Technologies |
|---|---|
| Frontend | Next.js 16.0.3, React 19.2, TypeScript 5.9, Tailwind CSS 4, Lucide React, Recharts, Framer Motion |
| Backend | Python 3.12, FastAPI 0.104.1, Uvicorn 0.24, SQLAlchemy 2.0, Pydantic 2.5 |
| Données | PostgreSQL 16, psycopg2, migrations de compatibilité SQLAlchemy |
| Documents | jsPDF, html2canvas, QRCode |
| Conteneurs | Docker, Docker Compose, images standalone Next.js et Python slim |
| Orchestration | Docker Swarm, Kubernetes et Minikube |

## Structure du projet

```text
cars-rental-main/
├── app/                         # Pages et route handler Next.js
│   ├── api/[...path]/           # Proxy serveur vers FastAPI
│   ├── cars/                    # Véhicules
│   ├── locataires/              # Locataires
│   ├── rentals/                 # Locations
│   ├── maintenance/             # Maintenance
│   ├── paiement/                # Paiements et factures
│   ├── profile/                 # Profil connecté
│   ├── login/                   # Connexion
│   └── register/                # Inscription
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   ├── security.py
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py
│       ├── cars.py
│       ├── renters.py
│       ├── rentals.py
│       ├── payments.py
│       └── maintenance.py
├── components/                  # Composants React métier
├── lib/                         # Client API et utilitaires
├── types/                       # Contrats TypeScript
├── prisma/                      # Schéma et outils Prisma historiques
├── public/                      # Logo et ressources statiques
├── uploads/                     # Photos persistantes téléversées
├── k8s/                         # Manifests Minikube/Kubernetes
├── resilience-tests/            # Architecture du futur framework de résilience
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── docker-stack.yml
├── next.config.ts
└── package.json
```

## Installation locale

### Prérequis

- Node.js 20 ou supérieur ;
- Python 3.12 recommandé ;
- PostgreSQL 16 ;
- npm ;
- Docker Desktop pour les déploiements conteneurisés.

### Variables d'environnement

Copier le modèle sans publier de secret :

```powershell
Copy-Item .env.example .env
```

Configurer au minimum :

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
SECRET_KEY=GENERATE_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
ACCESS_TOKEN_EXPIRE_MINUTES=60
INTERNAL_API_BASE_URL=http://127.0.0.1:8000
```

Ne jamais committer `.env`, un mot de passe PostgreSQL ou une clé JWT.

### Backend FastAPI

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Next.js

Dans un second terminal :

```powershell
npm install
$env:INTERNAL_API_BASE_URL="http://127.0.0.1:8000"
npm run dev
```

Accès :

- application : `http://localhost:3000` ;
- santé FastAPI via Next.js : `http://localhost:3000/api/health` ;
- Swagger : `http://localhost:8000/docs`.

## Démarrage avec Docker Compose

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f backend frontend
```

Arrêt sans suppression des volumes :

```powershell
docker compose down
```

Le frontend Docker utilise `INTERNAL_API_BASE_URL=http://backend:8000` sur le réseau Compose.

## Déploiement Kubernetes

Construire et charger les images dans Minikube :

```powershell
docker build -f Dockerfile.backend -t cars-rental-backend:latest .
docker build -f Dockerfile.frontend -t cars-rental-frontend:latest .

minikube image load cars-rental-backend:latest
minikube image load cars-rental-frontend:latest
```

Déployer :

```powershell
kubectl apply -f k8s/database.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

kubectl rollout status deployment/database
kubectl rollout status deployment/backend
kubectl rollout status deployment/frontend
```

Ouvrir uniquement le frontend :

```powershell
minikube service frontend
```

Dans Kubernetes, le pod frontend utilise `INTERNAL_API_BASE_URL=http://backend:8000`. Aucun port-forward backend n'est nécessaire pour le fonctionnement normal de l'application.

## Docker Swarm

Le projet contient [docker-stack.yml](./docker-stack.yml) pour le déploiement Swarm.

```powershell
docker swarm init
docker stack deploy -c docker-stack.yml cars-rental
docker stack services cars-rental
```

Avant un déploiement réel, fournir les secrets et paramètres attendus par la stack sans les écrire dans le dépôt.

## API FastAPI

Routes publiques :

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Santé du backend |
| POST | `/auth/login` | Connexion |
| POST | `/auth/register` | Inscription |

Routes privées principales :

| Ressource | Routes |
|---|---|
| Utilisateur | `/auth/me`, `/auth/me/password` |
| Véhicules | `/cars`, `/cars/{id}` |
| Locataires | `/renters`, `/renters/{id}`, `/renters/{id}/photo` |
| Locations | `/rentals`, `/rentals/{id}`, `/rentals/car/{id}`, `/rentals/renter/{id}` |
| Paiements | `/payments`, `/payments/{id}` |
| Maintenance | `/maintenance`, `/maintenance/{id}` |

Les routes privées attendent :

```http
Authorization: Bearer <JWT>
```

Le navigateur appelle ces routes à travers `/api`, par exemple `/api/cars` ou `/api/maintenance`.

## Configuration

| Variable | Composant | Rôle |
|---|---|---|
| `DATABASE_URL` | Backend | Connexion PostgreSQL |
| `SECRET_KEY` | Backend | Signature des JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Durée de validité du token |
| `INTERNAL_API_BASE_URL` | Serveur Next.js | Adresse interne de FastAPI |
| `NEXT_PUBLIC_COMPANY_*` | Frontend | Coordonnées affichées sur les factures |

`INTERNAL_API_BASE_URL` est une variable serveur. Elle ne doit pas être remplacée par une adresse Kubernetes exposée au navigateur.

## Framework de résilience

Le dossier [resilience-tests](./resilience-tests) contient un lanceur Windows interactif, des vérifications d'environnement, un mode dry-run, des baselines de santé, la persistance CSV/JSON, des graphiques, un rapport HTML et des tests unitaires.

Les scénarios perturbateurs qui ne disposent pas encore d'un mécanisme local sûr et réversible sont marqués `SKIPPED`. Ils ne sont jamais simulés avec de fausses métriques et ne sont pas exécutés automatiquement.

## Sécurité et bonnes pratiques

- protéger toutes les routes métier avec JWT ;
- conserver les secrets hors du dépôt ;
- utiliser les secrets Kubernetes ou Docker plutôt que des valeurs codées en dur ;
- ne jamais supprimer les volumes PostgreSQL pendant les opérations ordinaires ;
- conserver l'historique métier par archivage lorsque des relations existent ;
- valider les fichiers téléversés et limiter leur taille ;
- exécuter les conteneurs avec des utilisateurs non-root ;
- vérifier `/health` avec les probes Docker/Kubernetes.

## Vérifications utiles

```powershell
npm run build
docker build -f Dockerfile.frontend -t cars-rental-frontend:latest .
docker build -f Dockerfile.backend -t cars-rental-backend:latest .
```

## Projet académique

TuniCars+ est développé dans le cadre d'un projet académique de gestion de location automobile et d'étude comparative de résilience entre plateformes d'orchestration.

<div align="center">
  <img src="./public/logo-mark.png" alt="Symbole TuniCars+" width="90" />
  <p><strong>TuniCars+ - Car Rental Management</strong></p>
</div>
