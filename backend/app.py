"""
Alternative entry point - can run directly from backend folder
Usage: python app.py
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import uvicorn

from database import engine, Base, migrate_car_display_fields, migrate_payment_delete_rules, migrate_rental_return_fields, migrate_user_profile_fields, migrate_renter_contact_fields
from routers import auth, cars, maintenance, payments, renters, rentals

# Create database tables
Base.metadata.create_all(bind=engine)
migrate_rental_return_fields()
migrate_car_display_fields()
migrate_user_profile_fields()
migrate_renter_contact_fields()
migrate_payment_delete_rules()

# Initialize FastAPI app
app = FastAPI(
    title="Car Rental Management API",
    description="""
    A comprehensive REST API for managing a car rental business.
    
    ## Features
    
    * **Cars Management**: Create, read, update, and delete cars
    * **Renters Management**: Manage renter information
    * **Rentals Management**: Handle car rentals and returns
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
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
    return {
        "message": "Welcome to Car Rental Management API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "cars": "/cars",
            "renters": "/renters",
            "rentals": "/rentals"
            ,"auth": "/auth",
            "maintenance": "/maintenance"
        }
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "message": "API is running"}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception(
        "Unhandled API error method=%s path=%s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne inattendue est survenue."}
    )

if __name__ == "__main__":
    print("🚀 Starting Car Rental Management API...")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("📖 ReDoc: http://localhost:8000/redoc")
    print("\nPress CTRL+C to stop the server\n")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )





logger = logging.getLogger("cars_rental.api")
