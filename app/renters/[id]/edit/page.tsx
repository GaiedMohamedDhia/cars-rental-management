import { rentersAPI } from '@/lib/api-client'
import { RenterForm } from '@/components/RenterForm'
import { notFound } from 'next/navigation'

export default async function EditRenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await rentersAPI.getById(parseInt(id))
  
  if (!result.success || !result.data) {
    notFound()
  }

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Modifier le Locataire</h1>
          <p className="mt-1 text-sm text-gray-500">Mettre à jour les informations du client</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          <RenterForm renter={result.data} />
        </div>
      </div>
    </div>
  )
}
