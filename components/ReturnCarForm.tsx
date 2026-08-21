'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rentalsAPI } from '@/lib/api-client'
import type { Rental, Car, Renter } from '@/types'

interface ReturnCarFormProps {
  rental: Rental
}

export function ReturnCarForm({ rental }: ReturnCarFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const kmFin = parseInt(formData.get('kmFin') as string)
    
    // Calculate rental amount
    const startDate = new Date(rental.dateDebut)
    const endDate = new Date()
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const montantTotal = days * (rental.car?.prixLocation || 0)

    const result = await rentalsAPI.update(rental.id, {
      dateRetourReelle: endDate.toISOString(),
      kmFin,
      montantTotal
    })

    if (result.success) {
      router.refresh()
    } else {
      setError(result.error || 'Une erreur est survenue')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="kmFin" className="block text-sm font-medium text-gray-700 mb-2">
          Kilométrage Actuel (km) *
        </label>
        <input
          type="number"
          id="kmFin"
          name="kmFin"
          required
          min={rental.kmDebut}
          defaultValue={rental.kmDebut}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
          placeholder={`Doit être au moins ${rental.kmDebut} km`}
        />
        <p className="mt-1 text-sm text-gray-500">
          Kilométrage de début était {rental.kmDebut.toLocaleString()} km
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Rendre la voiture marquera cette location comme terminée et rendra la voiture disponible pour de nouvelles locations.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Retour en Cours...' : 'Rendre la Voiture'}
      </button>
    </form>
  )
}
