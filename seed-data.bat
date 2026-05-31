@echo off
REM Seed data via Backend API

echo.
echo ========================================
echo   🌱 Seeding Cars Rental Database
echo ========================================
echo.

echo Creating 3 cars...
echo.

curl -X POST "http://localhost:8000/cars" -H "Content-Type: application/json" -d "{\"numImma\": \"123-TN-456\", \"marque\": \"Toyota\", \"modele\": \"Yaris\", \"kilometrage\": 85000, \"prixLocation\": 90.50, \"etat\": 0}"
echo.

curl -X POST "http://localhost:8000/cars" -H "Content-Type: application/json" -d "{\"numImma\": \"789-TN-012\", \"marque\": \"Renault\", \"modele\": \"Clio\", \"kilometrage\": 45000, \"prixLocation\": 75.00, \"etat\": 0}"
echo.

curl -X POST "http://localhost:8000/cars" -H "Content-Type: application/json" -d "{\"numImma\": \"345-TN-678\", \"marque\": \"Peugeot\", \"modele\": \"208\", \"kilometrage\": 62000, \"prixLocation\": 80.00, \"etat\": 0}"
echo.

echo Creating 3 renters...
echo.

curl -X POST "http://localhost:8000/renters" -H "Content-Type: application/json" -d "{\"nom\": \"Ben Ali\", \"prenom\": \"Ahmed\", \"adresse\": \"Tunis, Tunisia\"}"
echo.

curl -X POST "http://localhost:8000/renters" -H "Content-Type: application/json" -d "{\"nom\": \"Trabelsi\", \"prenom\": \"Fatma\", \"adresse\": \"Sfax, Tunisia\"}"
echo.

curl -X POST "http://localhost:8000/renters" -H "Content-Type: application/json" -d "{\"nom\": \"Mansour\", \"prenom\": \"Mohamed\", \"adresse\": \"Sousse, Tunisia\"}"
echo.

echo.
echo ========================================
echo   ✅ Database seeded successfully!
echo ========================================
echo.
echo 🔗 Check your application:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8000/docs
echo.
pause
