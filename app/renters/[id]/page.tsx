import Link from 'next/link'
import { rentersAPI } from '@/lib/api-client'
import { notFound } from 'next/navigation'

export default async function RenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await rentersAPI.getById(parseInt(id))
  
  if (!result.success || !result.data) {
    notFound()
  }

  const renter = result.data
  const activeRentals = renter.rentals?.filter(r => !r.dateFin) || []
  const completedRentals = renter.rentals?.filter(r => r.dateFin) || []

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/renters" className="text-purple-600 hover:text-purple-700 text-sm font-medium">
            ← Retour aux Locataires
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{renter.prenom} {renter.nom}</h1>
              <p className="text-lg text-gray-500 mt-2">📍 {renter.adresse}</p>
            </div>
            <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              ID: #{renter.id}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Total Locations</div>
              <div className="text-2xl font-bold text-gray-900">{renter.rentals?.length || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Locations Actives</div>
              <div className="text-2xl font-bold text-green-600">{activeRentals.length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Terminées</div>
              <div className="text-2xl font-bold text-gray-900">{completedRentals.length}</div>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t">
            <Link
              href={`/renters/${renter.id}/edit`}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center font-medium"
            >
              Modifier le Locataire
            </Link>
            <Link
              href="/renters"
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Retour
            </Link>
          </div>
        </div>

        {/* Active Rentals */}
        {activeRentals.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Locations Actives</h2>
            <div className="space-y-3">
              {activeRentals.map((rental) => (
                <div key={rental.id} className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div>
                    <p className="font-medium text-gray-900">
                      {rental.car?.marque} {rental.car?.modele}
                    </p>
                    <p className="text-sm text-gray-500">
                      Début: {new Date(rental.dateDebut).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Link
                    href={`/rentals/${rental.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Voir Détails
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rental History */}
        {completedRentals.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Historique des Locations</h2>
            <div className="space-y-3">
              {completedRentals.map((rental) => (
                <div key={rental.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {rental.car?.marque} {rental.car?.modele}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(rental.dateDebut).toLocaleDateString('fr-FR')} - {rental.dateFin && new Date(rental.dateFin).toLocaleDateString('fr-FR')}
                    </p>
                    {rental.montantTotal && (
                      <p className="text-sm font-medium text-green-600 mt-1">
                        Total: {rental.montantTotal.toFixed(2)} DT
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/rentals/${rental.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Voir Détails
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
