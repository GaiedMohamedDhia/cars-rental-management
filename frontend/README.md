# 🎨 Frontend - Next.js

Next.js 16 frontend for the Car Rental Management System.

## 🚀 Setup

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run development server
npm run dev
```

Open http://localhost:3000

## 📁 Structure

```
app/
├── cars/          # Car management pages
├── renters/       # Renter management pages
├── rentals/       # Rental management pages
├── layout.tsx     # Root layout
└── page.tsx       # Home page

components/        # React components
├── CarForm.tsx
├── RenterForm.tsx
├── RentalForm.tsx
└── ...

types/            # TypeScript definitions
lib/              # Utilities (API client, Prisma)
prisma/           # Database schema & migrations
```

## 🗄️ Database Commands

```bash
# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## 🔧 Environment Variables

Create `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cars-rental?schema=public"
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🎨 Features

- Server-side rendering with Next.js App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Prisma ORM for database access
- Real-time data updates
- Responsive design

## 📦 Dependencies

- next: ^16.0.3
- react: ^19.2.0
- @prisma/client: ^5.22.0
- tailwindcss: ^4
- typescript: ^5





