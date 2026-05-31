import { RenterForm } from '@/components/RenterForm'

export default function NewRenterPage() {
  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ajouter un Nouveau Locataire</h1>
          <p className="mt-1 text-sm text-gray-500">Ajoutez un nouveau client à votre base de données</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          <RenterForm />
        </div>
      </div>
    </div>
  )
}
