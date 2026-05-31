import Link from 'next/link'
import { rentalsAPI } from '@/lib/api-client'
import { ReturnCarForm } from '@/components/ReturnCarForm'
import { notFound } from 'next/navigation'

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await rentalsAPI.getById(parseInt(id))
  
  if (!result.success || !result.data) {
    notFound()
  }

  const rental = result.data
  const isActive = !rental.dateFin
  
  // Calculate duration
  const startDate = new Date(rental.dateDebut)
  const endDate = rental.dateFin ? new Date(rental.dateFin) : new Date()
  const daysRented = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const estimatedTotal = daysRented * (rental.car?.prixLocation || 0)

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/rentals" className="text-green-600 hover:text-green-700 text-sm font-medium">
            ← Retour aux Locations
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className={`h-3 ${isActive ? 'bg-yellow-500' : 'bg-green-500'}`} />
          
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Détails de la Location</h1>
                <p className="text-lg text-gray-500 mt-2">ID: #{rental.id}</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                isActive 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {isActive ? '⏱ Active' : '✓ Terminée'}
              </span>
            </div>

            {/* Car & Renter Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-sm font-medium text-blue-900 mb-3">🚗 Informations Voiture</h3>
                <div className="space-y-2">
                  <p className="text-lg font-bold text-gray-900">
                    {rental.car?.marque} {rental.car?.modele}
                  </p>
                  <p className="text-sm text-gray-600">Immatriculation: {rental.car?.numImma}</p>
                  <p className="text-sm text-gray-600">Prix: {rental.car?.prixLocation.toFixed(2)} DT/jour</p>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="text-sm font-medium text-purple-900 mb-3">👤 Informations Locataire</h3>
                <div className="space-y-2">
                  <p className="text-lg font-bold text-gray-900">
                    {rental.renter?.prenom} {rental.renter?.nom}
                  </p>
                  <p className="text-sm text-gray-600">ID: #{rental.renter?.id}</p>
                  <p className="text-sm text-gray-600">Adresse: {rental.renter?.adresse}</p>
                </div>
              </div>
            </div>

            {/* Rental Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Date de Début</div>
                <div className="text-sm font-bold text-gray-900">
                  {startDate.toLocaleDateString('fr-FR')}
                </div>
              </div>
              
              {rental.dateFin && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Date de Fin</div>
                  <div className="text-sm font-bold text-gray-900">
                    {new Date(rental.dateFin).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              )}
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Kilométrage Début</div>
                <div className="text-sm font-bold text-gray-900">{rental.kmDebut.toLocaleString()} km</div>
              </div>
              
              {rental.kmFin && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Kilométrage Fin</div>
                  <div className="text-sm font-bold text-gray-900">{rental.kmFin.toLocaleString()} km</div>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-green-700 mb-1">Jours Loués</div>
                  <div className="text-2xl font-bold text-green-900">{daysRented}</div>
                </div>
                {rental.kmFin && (
                  <div>
                    <div className="text-sm text-green-700 mb-1">Distance Parcourue</div>
                    <div className="text-2xl font-bold text-green-900">
                      {(rental.kmFin - rental.kmDebut).toLocaleString()} km
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-green-700 mb-1">
                    {rental.montantTotal ? 'Montant Total' : 'Total Estimé'}
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {(rental.montantTotal || estimatedTotal).toFixed(2)} DT
                  </div>
                </div>
              </div>
            </div>

            {/* Return Car Form or Back Button */}
            {isActive ? (
              <div className="border-t pt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Rendre la Voiture</h2>
                <ReturnCarForm rental={rental} />
              </div>
            ) : (
              <div className="flex gap-4 pt-6 border-t">
                <Link
                  href="/rentals"
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-center font-medium"
                >
                  Retour aux Locations
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
