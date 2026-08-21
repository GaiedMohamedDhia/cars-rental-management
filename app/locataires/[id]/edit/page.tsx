'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { rentersAPI } from '@/lib/api-client'
import { RenterForm } from '@/components/RenterForm'
import type { Renter } from '@/types'

export default function EditRenterPage() {
  const params = useParams<{ id: string }>()
  const [renter, setRenter] = useState<Renter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Identifiant de locataire invalide.')
      setLoading(false)
      return
    }
    rentersAPI.getById(id).then((result) => {
      setRenter(result.data || null)
      setError(result.success ? '' : result.error || 'Locataire introuvable.')
      setLoading(false)
    })
  }, [params.id])

  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#07111f]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Modifier le locataire</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mettre à jour les informations du client</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-8 dark:border-white/10 dark:bg-slate-900">
          {loading ? (
            <div className="h-96 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          ) : renter ? (
            <RenterForm renter={renter} />
          ) : (
            <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
