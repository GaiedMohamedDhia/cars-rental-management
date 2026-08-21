"""
FastAPI Main Application
Car Rental Management System Backend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import uvicorn

try:
    from .database import Base, engine, migrate_car_display_fields, migrate_payment_delete_rules, migrate_rental_return_fields, migrate_user_profile_fields, migrate_renter_contact_fields
    from .routers import auth, cars, maintenance, payments, renters, rentals
except ImportError:
    from database import Base, engine, migrate_car_display_fields, migrate_payment_delete_rules, migrate_rental_return_fields, migrate_user_profile_fields, migrate_renter_contact_fields
    from routers import auth, cars, maintenance, payments, renters, rentals


# Create database tables
# In production, Alembic migrations are recommended.
Base.metadata.create_all(bind=engine)
migrate_rental_return_fields()
migrate_car_display_fields()
migrate_user_profile_fields()
migrate_renter_contact_fields()
migrate_payment_delete_rules()


# Initialize FastAPI application
app = FastAPI(
    title="Car Rental Management API",
    description="""
    A comprehensive REST API for managing a car rental business.

    ## Features

    * Cars management
    * Renters management
    * Rentals management
    * Authentication
    * Maintenance management

    ## Main endpoints

    * /cars
    * /renters
    * /rentals
    * /auth
    * /maintenance
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# Configure CORS
# Accepts frontend requests opened through localhost or 127.0.0.1
# regardless of the port used by Minikube.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API routers
app.include_router(cars.router)
app.include_router(renters.router)
app.include_router(rentals.router)
app.include_router(auth.router)
app.include_router(maintenance.router)
app.include_router(payments.router)
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint containing API information.
    """
    return {
        "message": "Welcome to Car Rental Management API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "cars": "/cars",
            "renters": "/renters",
            "rentals": "/rentals",
            "auth": "/auth",
            "maintenance": "/maintenance",
        },
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health-check endpoint used by Docker and Kubernetes.
    """
    return {
        "status": "healthy",
        "message": "API is running",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Handle unexpected application errors.
    """
    logger.exception(
        "Unhandled API error method=%s path=%s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne inattendue est survenue."},
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
# Technical details stay in server logs and are never returned to clients.
logger = logging.getLogger("cars_rental.api")
