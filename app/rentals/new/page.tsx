'use client'

import { useEffect, useState } from 'react'
import { RentalForm } from '@/components/RentalForm'
import { carsAPI, rentersAPI } from '@/lib/api-client'
import type { Car, Renter } from '@/types'

export default function NewRentalPage() {
  const [cars, setCars] = useState<Car[]>([])
  const [renters, setRenters] = useState<Renter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadFormData() {
      const [carsResult, rentersResult] = await Promise.all([
        carsAPI.getAll(true),
        rentersAPI.getAll(),
      ])
      setCars(carsResult.data || [])
      setRenters(rentersResult.data || [])
      setError(
        !carsResult.success
          ? carsResult.error || 'Impossible de charger les voitures disponibles.'
          : !rentersResult.success
            ? rentersResult.error || 'Impossible de charger les locataires.'
            : '',
      )
      setLoading(false)
    }
    void loadFormData()
  }, [])

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nouvelle Location</h1>
          <p className="mt-1 text-sm text-gray-500">Louer une voiture à un client</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          {loading ? (
            <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <RentalForm cars={cars} renters={renters} />
          )}
        </div>
      </div>
    </div>
  )
}
