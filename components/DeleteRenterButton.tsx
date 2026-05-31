'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rentersAPI } from '@/lib/api-client'

export function DeleteRenterButton({ renterId, renterName }: { renterId: number; renterName: string }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${renterName} ?`)) {
      return
    }

    setIsDeleting(true)
    const result = await rentersAPI.delete(renterId)
    
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
      className="text-red-600 hover:text-red-900 disabled:opacity-50"
    >
      {isDeleting ? 'Suppression...' : 'Supprimer'}
    </button>
  )
}
