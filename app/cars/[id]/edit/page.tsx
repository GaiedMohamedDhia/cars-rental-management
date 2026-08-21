'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { carsAPI } from '@/lib/api-client'
import { VehicleForm } from '@/components/CarForm'
import type { Car } from '@/types'

export default function EditCarPage() {
  const params = useParams<{ id: string }>()
  const [car, setCar] = useState<Car | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Identifiant de voiture invalide.')
      setLoading(false)
      return
    }
    carsAPI.getById(id).then((result) => {
      setCar(result.data || null)
      setError(result.success ? '' : result.error || 'Voiture introuvable.')
      setLoading(false)
    })
  }, [params.id])

  return (
    <div className="flex-1 bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Modifier la voiture</h1>
          <p className="mt-1 text-sm text-slate-400">Mettez à jour les informations du véhicule</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl sm:p-7">
          {loading ? (
            <div className="h-96 animate-pulse rounded-xl bg-slate-800" />
          ) : car ? (
            <VehicleForm car={car} />
          ) : (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
