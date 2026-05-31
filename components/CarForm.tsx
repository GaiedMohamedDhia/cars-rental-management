'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { carsAPI } from '@/lib/api-client'
import type { Car } from '@/types'

interface CarFormProps {
  car?: Car
}

export function CarForm({ car }: CarFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      numImma: formData.get('numImma') as string,
      marque: formData.get('marque') as string,
      modele: formData.get('modele') as string,
      kilometrage: parseInt(formData.get('kilometrage') as string),
      prixLocation: parseFloat(formData.get('prixLocation') as string),
    }

    const result = car 
      ? await carsAPI.update(car.id, data)
      : await carsAPI.create(data)

    if (result.success) {
      router.push('/cars')
      router.refresh()
    } else {
      setError(result.error || 'Une erreur est survenue')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="numImma" className="block text-sm font-medium text-gray-700 mb-2">
          Numéro d&apos;immatriculation *
        </label>
        <input
          type="text"
          id="numImma"
          name="numImma"
          defaultValue={car?.numImma}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
          placeholder="ex: ABC-123"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="marque" className="block text-sm font-medium text-gray-700 mb-2">
            Marque *
          </label>
          <input
            type="text"
            id="marque"
            name="marque"
            defaultValue={car?.marque}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            placeholder="ex: Toyota"
          />
        </div>

        <div>
          <label htmlFor="modele" className="block text-sm font-medium text-gray-700 mb-2">
            Modèle *
          </label>
          <input
            type="text"
            id="modele"
            name="modele"
            defaultValue={car?.modele}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            placeholder="ex: Corolla"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="kilometrage" className="block text-sm font-medium text-gray-700 mb-2">
            Kilométrage (km) *
          </label>
          <input
            type="number"
            id="kilometrage"
            name="kilometrage"
            defaultValue={car?.kilometrage}
            required
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            placeholder="0"
          />
        </div>

        <div>
          <label htmlFor="prixLocation" className="block text-sm font-medium text-gray-700 mb-2">
            Prix par Jour (DT) *
          </label>
          <input
            type="number"
            id="prixLocation"
            name="prixLocation"
            defaultValue={car?.prixLocation}
            required
            min="0"
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Enregistrement...' : car ? 'Modifier la Voiture' : 'Ajouter la Voiture'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
