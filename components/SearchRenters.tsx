'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SearchRentersInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }
    router.push(`/renters?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
      />
      <button
        type="submit"
        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
      >
        Rechercher
      </button>
      {search && (
        <button
          type="button"
          onClick={() => {
            setSearch('')
            router.push('/renters')
          }}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Effacer
        </button>
      )}
    </form>
  )
}

export function SearchRenters() {
  return (
    <Suspense fallback={
      <div className="flex gap-4">
        <input
          type="text"
          disabled
          placeholder="Chargement..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
        />
      </div>
    }>
      <SearchRentersInner />
    </Suspense>
  )
}
