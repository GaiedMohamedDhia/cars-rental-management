"""
FastAPI Main Application
Car Rental Management System Backend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

try:
    from .database import engine, Base
    from .routers import cars, renters, rentals, auth, maintenance
except ImportError:
    from database import engine, Base
    from routers import cars, renters, rentals, auth, maintenance

# Create database tables
# Note: In production, use Alembic for migrations instead
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Car Rental Management API",
    description="""
    A comprehensive REST API for managing a car rental business.
    
    ## Features
    
    * **Cars Management**: Create, read, update, and delete cars
    * **Renters Management**: Manage renter information
    * **Rentals Management**: Handle car rentals and returns
    
    ## Endpoints
    
    * **/cars**: Car operations (CRUD)
    * **/renters**: Renter operations (CRUD)
    * **/rentals**: Rental operations (CRUD)
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
# Allow your Next.js frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js default port
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Include routers
app.include_router(cars.router)
app.include_router(renters.router)
app.include_router(rentals.router)
app.include_router(auth.router)
app.include_router(maintenance.router)


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API information
    """
    return {
        "message": "Welcome to Car Rental Management API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "cars": "/cars",
            "renters": "/renters",
            "rentals": "/rentals"
        }
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "message": "API is running"
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler for unexpected errors
    """
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc)
        }
    )


# Run the application
if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Enable auto-reload during development
    )


