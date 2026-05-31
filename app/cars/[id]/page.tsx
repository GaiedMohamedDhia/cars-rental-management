import Link from 'next/link'
import CarAvatar from '../../../components/CarAvatar'
import { carsAPI } from '@/lib/api-client'
import { notFound } from 'next/navigation'

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await carsAPI.getById(parseInt(id))
  
  if (!result.success || !result.data) {
    notFound()
  }

  const car = result.data

  return (
    <div className="flex-1 bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/cars" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            ← Retour aux Voitures
          </Link>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-md overflow-hidden border border-[var(--border)]">
          <div className={`h-3 ${car.etat === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
          
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <CarAvatar alt={`${car.marque} ${car.modele}`} src={car.photoUrl} />
                <div>
                  <h1 className="text-3xl font-bold text-white">{car.marque} {car.modele}</h1>
                  <p className="text-lg text-[var(--muted)] mt-2">📋 {car.numImma}</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                car.etat === 0 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {car.etat === 0 ? '✓ Disponible' : '⏱ Louée'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Kilométrage</div>
                <div className="text-2xl font-bold text-gray-900">{car.kilometrage.toLocaleString()} km</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-sm text-gray-600 mb-1">Prix par Jour</div>
                <div className="text-2xl font-bold text-gray-900">{car.prixLocation.toFixed(2)} DT</div>
              </div>
            </div>

            {car.rentals && car.rentals.length > 0 && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Historique des Locations</h2>
                <div className="space-y-3">
                  {car.rentals.slice(0, 5).map((rental) => (
                    <div key={rental.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {rental.renter?.prenom} {rental.renter?.nom}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(rental.dateDebut).toLocaleDateString('fr-FR')}
                          {rental.dateFin && ` - ${new Date(rental.dateFin).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                      {rental.dateFin ? (
                        <span className="text-sm text-gray-500">Terminée</span>
                      ) : (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-8 pt-6 border-t">
              <Link
                href={`/cars/${car.id}/edit`}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
              >
                Modifier la Voiture
              </Link>
              <Link
                href="/cars"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Retour
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
