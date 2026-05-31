import Link from 'next/link'
import CarAvatar from '../../components/CarAvatar'
import { carsAPI } from '@/lib/api-client'
import { DeleteCarButton } from '@/components/DeleteCarButton'

export default async function CarsPage() {
  const result = await carsAPI.getAll()
  const cars = result.data || []

  return (
    <div className="flex-1 bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Voitures</h1>
            <p className="mt-1 text-sm text-gray-500">Gérez votre parc automobile</p>
          </div>
          <Link
            href="/cars/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter une Voiture
          </Link>
        </div>

        {/* Cars Grid */}
        {cars.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Aucune voiture trouvée</h3>
            <p className="mt-2 text-sm text-gray-500">Commencez par ajouter votre première voiture.</p>
            <Link
              href="/cars/new"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ajouter une Voiture
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => (
              <div
                key={car.id}
                className="bg-[var(--card)] rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-[var(--border)]"
              >
                <div className={`h-2 ${car.etat === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <CarAvatar alt={`${car.marque} ${car.modele}`} src={car.photoUrl} />
                      <div>
                        <h3 className="text-xl font-bold text-white">{car.marque} {car.modele}</h3>
                        <p className="text-sm text-[var(--muted)] mt-1">📋 {car.numImma}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      car.etat === 0 
                        ? 'bg-green-600 text-white' 
                        : 'bg-red-600 text-white'
                    }`}>
                      {car.etat === 0 ? 'Disponible' : 'Louée'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-[var(--muted)]">
                    <div className="flex justify-between">
                      <span>Kilométrage</span>
                      <span className="font-medium text-white">{car.kilometrage.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prix/Jour</span>
                      <span className="font-medium text-white">{car.prixLocation.toFixed(2)} DT</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-[var(--border)]">
                    <Link
                      href={`/cars/${car.id}`}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center text-sm font-medium"
                    >
                      Voir
                    </Link>
                    <Link
                      href={`/cars/${car.id}/edit`}
                      className="flex-1 px-4 py-2 bg-[rgba(255,255,255,0.03)] text-white rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors text-center text-sm font-medium"
                    >
                      Modifier
                    </Link>
                    <DeleteCarButton carId={car.id} carName={`${car.marque} ${car.modele}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
