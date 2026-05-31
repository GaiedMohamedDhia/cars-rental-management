# Seed data for Docker containers
Write-Host "Seeding Cars Rental Database via Docker..." -ForegroundColor Green
Write-Host ""

# Create 3 cars
Write-Host "Creating 3 cars..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "http://localhost:8000/cars" -Method POST -ContentType "application/json" -Body '{"numImma": "123-TN-456", "marque": "Toyota", "modele": "Yaris", "kilometrage": 85000, "prixLocation": 90.50, "etat": 0}' | Out-Null
Invoke-WebRequest -Uri "http://localhost:8000/cars" -Method POST -ContentType "application/json" -Body '{"numImma": "789-TN-012", "marque": "Renault", "modele": "Clio", "kilometrage": 45000, "prixLocation": 75.00, "etat": 0}' | Out-Null
Invoke-WebRequest -Uri "http://localhost:8000/cars" -Method POST -ContentType "application/json" -Body '{"numImma": "345-TN-678", "marque": "Peugeot", "modele": "208", "kilometrage": 62000, "prixLocation": 80.00, "etat": 0}' | Out-Null

# Create 3 renters
Write-Host "Creating 3 renters..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "http://localhost:8000/renters" -Method POST -ContentType "application/json" -Body '{"nom": "Ben Ali", "prenom": "Ahmed", "adresse": "Tunis, Tunisia"}' | Out-Null
Invoke-WebRequest -Uri "http://localhost:8000/renters" -Method POST -ContentType "application/json" -Body '{"nom": "Trabelsi", "prenom": "Fatma", "adresse": "Sfax, Tunisia"}' | Out-Null
Invoke-WebRequest -Uri "http://localhost:8000/renters" -Method POST -ContentType "application/json" -Body '{"nom": "Mansour", "prenom": "Mohamed", "adresse": "Sousse, Tunisia"}' | Out-Null

Write-Host ""
Write-Host "Database seeded successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Access your application:" -ForegroundColor Yellow
Write-Host "   Frontend: http://localhost:3000"
Write-Host "   Backend:  http://localhost:8000/docs"
Write-Host ""
