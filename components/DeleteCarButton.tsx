'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { carsAPI } from '@/lib/api-client'

export function DeleteCarButton({ carId, carName }: { carId: number; carName: string }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${carName} ?`)) {
      return
    }

    setIsDeleting(true)
    const result = await carsAPI.delete(carId)
    
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error)
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
    >
      {isDeleting ? 'Suppression...' : 'Supprimer'}
    </button>
  )
}
