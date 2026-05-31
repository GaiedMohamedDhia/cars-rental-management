'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rentersAPI } from '@/lib/api-client'
import type { Renter } from '@/types'

interface RenterFormProps {
  renter?: Renter
}

export function RenterForm({ renter }: RenterFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      nom: formData.get('nom') as string,
      prenom: formData.get('prenom') as string,
      adresse: formData.get('adresse') as string,
    }

    const result = renter 
      ? await rentersAPI.update(renter.id, data)
      : await rentersAPI.create(data)

    if (result.success) {
      router.push('/renters')
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">
            Prénom *
          </label>
          <input
            type="text"
            id="prenom"
            name="prenom"
            defaultValue={renter?.prenom}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            placeholder="Jean"
          />
        </div>

        <div>
          <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
            Nom *
          </label>
          <input
            type="text"
            id="nom"
            name="nom"
            defaultValue={renter?.nom}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            placeholder="Dupont"
          />
        </div>
      </div>

      <div>
        <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-2">
          Adresse *
        </label>
        <textarea
          id="adresse"
          name="adresse"
          defaultValue={renter?.adresse}
          required
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
          placeholder="123 Rue de la Paix, Paris, France"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Enregistrement...' : renter ? 'Modifier le Locataire' : 'Ajouter le Locataire'}
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
