import Link from 'next/link'
import { rentalsAPI } from '@/lib/api-client'

export default async function RentalsPage() {
  const result = await rentalsAPI.getAll()
  const rentals = result.data || []

  const now = new Date()
  
  // Active = Car not returned yet (kmFin is null) AND (no end date OR end date in future)
  const activeRentals = rentals.filter(r => {
    // If car was returned (kmFin set), it's not active
    if (r.kmFin !== null) return false
    // If no end date, it's active
    if (!r.dateFin) return true
    // If end date is in future or today, it's active
    const endDate = new Date(r.dateFin)
    return endDate >= now
  })
  
  // Completed = Car returned (kmFin set) OR end date has passed
  const completedRentals = rentals.filter(r => {
    // If car was returned, it's completed
    if (r.kmFin !== null) return true
    // If no end date and car not returned, it's not completed
    if (!r.dateFin) return false
    // If end date has passed, it's completed
    const endDate = new Date(r.dateFin)
    return endDate < now
  })

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Locations</h1>
            <p className="mt-1 text-sm text-gray-500">Gérez les locations et retours de voitures</p>
          </div>
          <Link
            href="/rentals/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle Location
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button className="px-4 py-2 border-b-2 border-green-500 text-green-600 font-medium">
              Actives ({activeRentals.length})
            </button>
            <a href="#history" className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium">
              Historique ({completedRentals.length})
            </a>
          </div>
        </div>

        {/* Active Rentals */}
        {activeRentals.length === 0 && completedRentals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Aucune location trouvée</h3>
            <p className="mt-2 text-sm text-gray-500">Commencez par créer votre première location.</p>
            <Link
              href="/rentals/new"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Nouvelle Location
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Locations Actives</h2>
              {activeRentals.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                  Aucune location active pour le moment
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {activeRentals.map((rental) => (
                    <div key={rental.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="h-2 bg-yellow-500" />
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {rental.car?.marque} {rental.car?.modele}
                            </h3>
                            <p className="text-sm text-gray-500">📋 {rental.car?.numImma}</p>
                          </div>
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            Active
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Locataire</span>
                            <span className="font-medium text-gray-900">
                              {rental.renter?.prenom} {rental.renter?.nom}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Date de début</span>
                            <span className="font-medium text-gray-900">
                              {new Date(rental.dateDebut).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          {rental.dateFin && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Date de fin prévue</span>
                              <span className="font-medium text-orange-600">
                                {new Date(rental.dateFin).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Kilométrage début</span>
                            <span className="font-medium text-gray-900">{rental.kmDebut.toLocaleString()} km</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Prix/Jour</span>
                            <span className="font-medium text-gray-900">{rental.car?.prixLocation.toFixed(2)} DT</span>
                          </div>
                          {rental.montantTotal && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Montant estimé</span>
                              <span className="font-medium text-green-600">{rental.montantTotal.toFixed(2)} DT</span>
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/rentals/${rental.id}`}
                          className="block w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center font-medium"
                        >
                          Voir Détails 
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rental History */}
            <div id="history">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Historique des Locations</h2>
              {completedRentals.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                  Aucune location terminée pour le moment
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Voiture
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Locataire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Période
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {completedRentals.map((rental) => (
                        <tr key={rental.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {rental.car?.marque} {rental.car?.modele}
                            </div>
                            <div className="text-sm text-gray-500">{rental.car?.numImma}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {rental.renter?.prenom} {rental.renter?.nom}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(rental.dateDebut).toLocaleDateString('fr-FR')} - {rental.dateFin && new Date(rental.dateFin).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            {rental.montantTotal?.toFixed(2)} DT
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/rentals/${rental.id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Voir Détails
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}


