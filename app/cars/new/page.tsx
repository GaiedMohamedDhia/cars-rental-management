import { CarForm } from '@/components/CarForm'

export default function NewCarPage() {
  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ajouter une Nouvelle Voiture</h1>
          <p className="mt-1 text-sm text-gray-500">Ajoutez un nouveau véhicule à votre parc</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          <CarForm />
        </div>
      </div>
    </div>
  )
}
