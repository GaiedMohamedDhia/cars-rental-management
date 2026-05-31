import { RentalForm } from '@/components/RentalForm'
import { carsAPI, rentersAPI } from '@/lib/api-client'

export default async function NewRentalPage() {
  const [carsResult, rentersResult] = await Promise.all([
    carsAPI.getAll(true), // true = available only
    rentersAPI.getAll()
  ])

  const cars = carsResult.data || []
  const renters = rentersResult.data || []

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nouvelle Location</h1>
          <p className="mt-1 text-sm text-gray-500">Louer une voiture à un client</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          <RentalForm cars={cars} renters={renters} />
        </div>
      </div>
    </div>
  )
}
