import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data
  await prisma.rental.deleteMany()
  await prisma.car.deleteMany()
  await prisma.renter.deleteMany()

  console.log('✅ Cleared existing data')

  // Seed Cars
  const cars = await Promise.all([
    prisma.car.create({
      data: {
        numImma: '123-TN-456',
        marque: 'Toyota',
        modele: 'Yaris',
        kilometrage: 85000,
        etat: 0,
        prixLocation: 90.50,
      },
    }),
    prisma.car.create({
      data: {
        numImma: '789-TN-012',
        marque: 'Renault',
        modele: 'Clio',
        kilometrage: 45000,
        etat: 0,
        prixLocation: 75.00,
      },
    }),
    prisma.car.create({
      data: {
        numImma: '345-TN-678',
        marque: 'Peugeot',
        modele: '208',
        kilometrage: 62000,
        etat: 0,
        prixLocation: 80.00,
      },
    }),
  ])

  console.log(`✅ Created ${cars.length} cars`)

  // Seed Renters
  const renters = await Promise.all([
    prisma.renter.create({
      data: {
        nom: 'Ben Ali',
        prenom: 'Ahmed',
        adresse: 'Tunis, Tunisia',
      },
    }),
    prisma.renter.create({
      data: {
        nom: 'Trabelsi',
        prenom: 'Fatma',
        adresse: 'Sfax, Tunisia',
      },
    }),
    prisma.renter.create({
      data: {
        nom: 'Mansour',
        prenom: 'Mohamed',
        adresse: 'Sousse, Tunisia',
      },
    }),
  ])

  console.log(`✅ Created ${renters.length} renters`)

  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

