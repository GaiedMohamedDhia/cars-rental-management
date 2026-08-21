'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CalendarDays, Fuel, Gauge, Palette, Pencil, Settings2, Tag, Users, WalletCards } from 'lucide-react'
import { carsAPI } from '@/lib/api-client'
import type { Car } from '@/types'

const statusMap = {
  0: { label: 'Disponible', style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  1: { label: 'Louée', style: 'bg-red-500/15 text-red-400 border-red-500/30' },
  2: { label: 'En maintenance', style: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  3: { label: 'Indisponible', style: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
} as const

export default function CarDetailPage() {
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

  if (loading) {
    return <main className="min-h-full flex-1 bg-[var(--bg)] p-8"><div className="mx-auto h-[520px] max-w-5xl animate-pulse rounded-3xl bg-slate-900" /></main>
  }
  if (!car) {
    return <main className="min-h-full flex-1 bg-[var(--bg)] p-8"><div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">{error}</div></main>
  }
  const status = statusMap[(car.etat in statusMap ? car.etat : 3) as keyof typeof statusMap]
  const details = [
    { icon: Gauge, label: 'Kilométrage', value: `${Number(car.kilometrage).toLocaleString('fr-FR')} km` },
    { icon: WalletCards, label: 'Prix par jour', value: `${Number(car.prixLocation).toFixed(2)} DT` },
    car.annee ? { icon: CalendarDays, label: 'Année', value: String(car.annee) } : null,
    car.carburant ? { icon: Fuel, label: 'Carburant', value: car.carburant } : null,
    car.transmission ? { icon: Settings2, label: 'Boîte de vitesses', value: car.transmission } : null,
    car.nombrePlaces ? { icon: Users, label: 'Nombre de places', value: String(car.nombrePlaces) } : null,
    car.couleur ? { icon: Palette, label: 'Couleur', value: car.couleur } : null,
    car.categorie ? { icon: Tag, label: 'Catégorie', value: car.categorie } : null,
  ].filter(Boolean) as { icon: typeof Gauge; label: string; value: string }[]

  return <main className="min-h-full flex-1 bg-[var(--bg)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/cars" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-cyan-400"><ArrowLeft size={16} /> Retour aux voitures</Link>
      <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-slate-950/30">
        <div className="relative flex h-[230px] items-center justify-center bg-slate-950 p-4 sm:h-[280px]">
          <div className="relative h-full w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
            <Image src={car.photoUrl || '/car-placeholder.svg'} alt={`${car.marque} ${car.modele}`} fill unoptimized={Boolean(car.photoUrl)} priority className="object-contain object-center p-2" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 to-transparent" />
          <span className={`absolute right-4 top-4 rounded-full border px-3 py-1.5 text-xs font-black backdrop-blur ${status.style}`}>{status.label}</span>
          <div className="absolute bottom-5 left-5">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">{car.marque}</p>
            <h1 className="text-3xl font-black text-white">{car.modele}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-300">{car.numImma}</p>
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{details.map(({ icon: Icon, label, value }) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4"><Icon size={17} className="mb-3 text-cyan-400" /><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-100">{value}</p></div>)}</div>
          <div className="mt-6 flex justify-end border-t border-slate-800 pt-5"><Link href={`/cars/${car.id}/edit`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-black text-slate-950"><Pencil size={16} /> Modifier la voiture</Link></div>
        </div>
      </article>
    </div>
  </main>
}
