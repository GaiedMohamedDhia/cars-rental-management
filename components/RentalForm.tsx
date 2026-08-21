'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { rentalsAPI } from '@/lib/api-client'
import type { Car, Rental, Renter } from '@/types'

interface RentalFormProps {
  cars: Car[]
  renters: Renter[]
  rental?: Rental
}

const dateInputValue = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0]
}

export function RentalForm({ cars, renters, rental }: RentalFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedCar, setSelectedCar] = useState<Car | null>(
    rental ? cars.find((car) => car.id === rental.carId) || rental.car || null : null,
  )
  const [startDate, setStartDate] = useState(
    dateInputValue(rental?.dateDebut) || new Date().toISOString().split('T')[0],
  )
  const [endDate, setEndDate] = useState(
    dateInputValue(rental?.dateFinPrevue || rental?.dateFin),
  )
  const [estimatedPrice, setEstimatedPrice] = useState(rental?.montantTotal || 0)

  const calculatePrice = (
    car: Car | null,
    startDateValue: string,
    endDateValue: string,
  ) => {
    if (!car || !startDateValue || !endDateValue) {
      setEstimatedPrice(0)
      return
    }
    const start = new Date(`${startDateValue}T00:00:00`)
    const end = new Date(endDateValue)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days > 0) {
      setEstimatedPrice(days * car.prixLocation)
    } else {
      setEstimatedPrice(0)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      carId: parseInt(formData.get('carId') as string),
      renterId: parseInt(formData.get('renterId') as string),
      kmDebut: selectedCar?.kilometrage || 0,
      dateDebut: new Date(`${startDate}T00:00:00`).toISOString(),
      dateFinPrevue: endDate
        ? new Date(`${endDate}T23:59:59`).toISOString()
        : undefined,
      montantTotal: estimatedPrice > 0 ? estimatedPrice : undefined,
    }

    const result = rental
      ? await rentalsAPI.update(rental.id, data)
      : await rentalsAPI.create(data)

    if (result.success) {
      router.push('/rentals')
      router.refresh()
    } else {
      setError(result.error || 'Une erreur est survenue')
      setIsSubmitting(false)
    }
  }

  if (cars.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Aucune voiture disponible pour le moment.</p>
        <Link href="/cars/new" className="text-blue-600 hover:text-blue-700 font-medium">
          Ajouter une nouvelle voiture
        </Link>
      </div>
    )
  }

  if (renters.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Aucun locataire dans le système.</p>
        <Link href="/locataires/new" className="text-purple-600 hover:text-purple-700 font-medium">
          Ajouter un nouveau locataire
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
      <form onSubmit={handleSubmit} className="space-y-7">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="carId" className="block text-base font-semibold text-gray-800 mb-2">
            Voiture à louer <span className="text-red-500">*</span>
          </label>
          <select
            id="carId"
            name="carId"
            required
            defaultValue={rental?.carId ? String(rental.carId) : ""}
            onChange={(e) => {
              const car = cars.find(c => c.id === parseInt(e.target.value)) || null
              setSelectedCar(car)
              calculatePrice(car, startDate, endDate)
            }}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 bg-white text-gray-900 text-base"
          >
            <option value="" disabled>Choisir une voiture...</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.marque} {car.modele} - {car.numImma} ({car.prixLocation.toFixed(2)} DT/jour)
              </option>
            ))}
          </select>

          {selectedCar && (
            <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Kilométrage actuel:</span>
                  <span className="ml-2 font-bold text-blue-900">{selectedCar.kilometrage.toLocaleString()} km</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Prix/Jour:</span>
                  <span className="ml-2 font-bold text-blue-900">{selectedCar.prixLocation.toFixed(2)} DT</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="dateDebut" className="block text-base font-semibold text-gray-800 mb-2">
            Date de début <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="dateDebut"
            name="dateDebut"
            required
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              calculatePrice(selectedCar, e.target.value, endDate)
            }}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 text-gray-900 text-base"
          />
        </div>

        <div>
          <label htmlFor="renterId" className="block text-base font-semibold text-gray-800 mb-2">
            Locataire <span className="text-red-500">*</span>
          </label>
          <select
            id="renterId"
            name="renterId"
            required
            defaultValue={rental?.renterId ? String(rental.renterId) : ""}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 bg-white text-gray-900 text-base"
          >
            <option value="" disabled>Choisir un locataire...</option>
            {renters.map((renter) => (
              <option key={renter.id} value={renter.id}>
                {renter.prenom} {renter.nom} - {renter.adresse}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dateFin" className="block text-base font-semibold text-gray-800 mb-2">
            Date de fin prévue <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="dateFin"
            name="dateFin"
            required
            min={startDate}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              calculatePrice(selectedCar, startDate, e.target.value)
            }}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-400 text-gray-900 text-base"
          />
        </div>

        <div>
          <label htmlFor="kmDebut" className="block text-base font-semibold text-gray-800 mb-2">
            Kilométrage de départ
          </label>
          <input
            id="kmDebut"
            name="kmDebut"
            type="text"
            readOnly
            value={selectedCar ? `${selectedCar.kilometrage.toLocaleString()} km` : ''}
            placeholder="Sélectionnez d’abord une voiture"
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-base"
          />
        </div>

        {estimatedPrice > 0 && (
          <div className="flex items-center justify-between bg-green-50 border-2 border-green-300 rounded-xl p-4 shadow-sm">
            <span className="text-green-900 font-semibold">Prix total estimé</span>
            <span className="text-2xl font-bold text-green-700 bg-white px-4 py-1 rounded-lg border border-green-200 shadow">{estimatedPrice.toFixed(2)} DT</span>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-blue-800">
            <strong>Note :</strong> La location commence aujourd&apos;hui avec le kilométrage actuel de la voiture.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow hover:from-green-600 hover:to-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                Création...
              </span>
            ) : rental ? 'Mettre à jour la location' : 'Enregistrer la location'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl shadow hover:bg-gray-200 transition-colors font-semibold"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
