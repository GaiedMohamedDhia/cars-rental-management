"""
Simple script to run the FastAPI server
Can be run from project root OR from backend directory
"""
import uvicorn
import sys
import os

if __name__ == "__main__":
    print(" Starting Car Rental Management API...")
    print(" API Documentation: http://localhost:8000/docs")
    print(" ReDoc: http://localhost:8000/redoc")
    print(" Auto-reload enabled for development")
    print("\nPress CTRL+C to stop the server\n")
    
    
    current_dir = os.path.basename(os.getcwd())
    if current_dir == "backend":
        
        os.chdir("..")
        print(" Changed directory to project root\n")
    
    
    sys.path.insert(0, os.getcwd())
    
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

