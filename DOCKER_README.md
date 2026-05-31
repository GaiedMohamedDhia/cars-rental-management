# 🐳 Guide Docker - TuniCars+

## Vue d'ensemble

Ce projet utilise Docker et Docker Compose pour conteneuriser l'application en 3 services :

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `database` | postgres:16-alpine | 5432 | Base de données PostgreSQL |
| `backend` | cars-rental-backend | 8000 | API FastAPI |
| `frontend` | cars-rental-frontend | 3000 | Application Next.js |

---

## 🚀 Démarrage Rapide

```bash
# Construire et démarrer tous les services
docker-compose up -d

# Vérifier le statut
docker-compose ps

# Voir les logs en temps réel
docker-compose logs -f
```

**Accès :**
- Frontend : http://localhost:3000
- Backend API : http://localhost:8000
- Documentation API : http://localhost:8000/docs

---

## 📁 Fichiers Docker

### docker-compose.yml

```yaml
version: '3.8'

services:
  database:
    image: postgres:16-alpine
    container_name: cars-rental-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: cars-rental
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: cars-rental-backend
    environment:
      DATABASE_URL: postgresql://postgres:postgres@database:5432/cars-rental
    ports:
      - "8000:8000"
    depends_on:
      database:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        NEXT_PUBLIC_API_BASE_URL: http://localhost:8000
    container_name: cars-rental-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    extra_hosts:
      - "localhost:host-gateway"

volumes:
  postgres_data:
```

### Dockerfile.backend

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc postgresql-client

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile.frontend

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
# ... autres variables d'environnement

RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system nodejs && adduser --system nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 📋 Commandes Docker

### Gestion des Conteneurs

```bash
# Démarrer les services
docker-compose up -d

# Arrêter les services
docker-compose down

# Redémarrer un service spécifique
docker-compose restart frontend

# Voir les logs
docker-compose logs -f [service]

# Accéder au shell d'un conteneur
docker exec -it cars-rental-backend bash
docker exec -it cars-rental-frontend sh
```

### Gestion des Images

```bash
# Reconstruire toutes les images
docker-compose build

# Reconstruire sans cache
docker-compose build --no-cache

# Reconstruire un service spécifique
docker-compose build frontend
```

### Gestion des Données

```bash
# Supprimer les conteneurs ET les volumes
docker-compose down -v

# Sauvegarder la base de données
docker exec cars-rental-db pg_dump -U postgres cars-rental > backup.sql

# Restaurer la base de données
cat backup.sql | docker exec -i cars-rental-db psql -U postgres cars-rental
```

---

## 🔧 Configuration

### Variables d'Environnement

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | backend | URL PostgreSQL |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | URL de l'API |
| `NODE_ENV` | frontend | Mode (production) |

### Réseau Docker

Tous les services sont sur le même réseau Docker et peuvent communiquer via leurs noms de service :
- `database` → PostgreSQL
- `backend` → FastAPI
- `frontend` → Next.js

Le frontend utilise `extra_hosts: - "localhost:host-gateway"` pour que les appels SSR vers `localhost:8000` fonctionnent.

---

## 🐛 Dépannage

### Le frontend ne peut pas se connecter à l'API

**Erreur :** `ERR_NAME_NOT_RESOLVED` ou `Failed to fetch`

**Solution :**
1. Vérifier que `NEXT_PUBLIC_API_BASE_URL` est `http://localhost:8000`
2. Ajouter `extra_hosts` au service frontend
3. Reconstruire le frontend

### La base de données ne se connecte pas

**Solution :**
```bash
# Vérifier que PostgreSQL est prêt
docker-compose logs database

# Vérifier le healthcheck
docker inspect cars-rental-db | grep -A 10 Health
```

### Les modifications ne sont pas prises en compte

**Solution :**
```bash
# Reconstruire sans cache
docker-compose build --no-cache
docker-compose up -d
```

---

## 🚢 Push vers Docker Hub

```bash
# Se connecter à Docker Hub
docker login

# Taguer les images
docker tag cars-rental-backend username/cars-rental-backend:latest
docker tag cars-rental-frontend username/cars-rental-frontend:latest

# Pousser les images
docker push username/cars-rental-backend:latest
docker push username/cars-rental-frontend:latest
```

---

## 📊 Monitoring

```bash
# Voir les ressources utilisées
docker stats

# Inspecter un conteneur
docker inspect cars-rental-backend

# Voir les logs avec timestamps
docker-compose logs -f -t
```
