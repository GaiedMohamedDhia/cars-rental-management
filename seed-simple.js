const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Cars
  const cars = await prisma.car.createMany({
    data: [
      { numImma: '123-TN-456', marque: 'Toyota', modele: 'Yaris', kilometrage: 85000, etat: 0, prixLocation: 90.50 },
      { numImma: '789-TN-012', marque: 'Renault', modele: 'Clio', kilometrage: 45000, etat: 0, prixLocation: 75.00 },
      { numImma: '345-TN-678', marque: 'Peugeot', modele: '208', kilometrage: 62000, etat: 0, prixLocation: 80.00 }
    ],
    skipDuplicates: true
  });
  
  console.log(`✅ Created ${cars.count} cars`);

  // Create Renters
  const renters = await prisma.renter.createMany({
    data: [
      { nom: 'Ben Ali', prenom: 'Ahmed', adresse: 'Tunis, Tunisia' },
      { nom: 'Trabelsi', prenom: 'Fatma', adresse: 'Sfax, Tunisia' },
      { nom: 'Mansour', prenom: 'Mohamed', adresse: 'Sousse, Tunisia' }
    ],
    skipDuplicates: true
  });

  console.log(`✅ Created ${renters.count} renters`);
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


