'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { RentalForm } from '@/components/RentalForm'
import { carsAPI, rentersAPI, rentalsAPI } from '@/lib/api-client'
import type { Car, Rental, Renter } from '@/types'

export default function EditRentalPage() {
  const params = useParams<{ id: string }>()
  const [rental, setRental] = useState<Rental | null>(null)
  const [cars, setCars] = useState<Car[]>([])
  const [renters, setRenters] = useState<Renter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Identifiant de location invalide.')
      setLoading(false)
      return
    }
    Promise.all([
      rentalsAPI.getById(id),
      carsAPI.getAll(),
      rentersAPI.getAll(),
    ]).then(([rentalResult, carsResult, rentersResult]) => {
      const currentRental = rentalResult.data || null
      setRental(currentRental)
      setCars(
        (carsResult.data || []).filter(
          (car) => car.etat === 0 || car.id === currentRental?.carId,
        ),
      )
      setRenters(rentersResult.data || [])
      setError(
        !rentalResult.success
          ? rentalResult.error || 'Location introuvable.'
          : !carsResult.success
            ? carsResult.error || 'Impossible de charger les voitures.'
            : !rentersResult.success
              ? rentersResult.error || 'Impossible de charger les locataires.'
              : '',
      )
      setLoading(false)
    })
  }, [params.id])

  return (
    <main className="min-h-full flex-1 bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href={rental ? `/rentals/${rental.id}` : '/rentals'} className="text-sm font-bold text-emerald-700">
          ← Retour à la location
        </Link>
        <h1 className="mt-4 text-3xl font-black text-slate-900">Modifier la location</h1>
        <p className="mt-1 text-sm text-slate-500">Mettez à jour le véhicule, le locataire ou les dates.</p>
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-md">
          {loading ? (
            <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
          ) : rental && !error ? (
            <RentalForm rental={rental} cars={cars} renters={renters} />
          ) : (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>
          )}
        </section>
      </div>
    </main>
  )
}
